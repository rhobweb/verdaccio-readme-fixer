/**
 * Script to fix Verdaccio README.md files.
 *
 * Verdaccio appears to pack the README.md into the package.json file and never update it.
 * This utility updates the package.json file with the packed README.md file.
 *
 * Internal hyperlinks don't appear to work under Verdaccio.
 * However, Verdaccio web interface doesn't want to show the updated file.
 */
'use strict';

const path = require( 'path' ) ;
const fs   = require( 'fs' ) ;
const fsp  = require( 'fs/promises' ) ;

const DEFAULT_README_PATHNAME = './README.md' ;           // Use this if no pathname specified on the command line
const DEFAULT_REGISTRY        = 'http://localhost:4873' ; // Use this if the package.json does not contain a publishConfig.registry.
const REL_WEB_PATH            = '/-/web/detail/' ;        // The Verdaccio Web UI path to the README pages
const PACKAGE_FILENAME        = 'package.json' ;
const BACKUP_DIR              = '/tmp' ;

/**
 * @param {string} pathname : a file pathname
 * @returns a unique absolute pathname to backup the file to.
 */
const BACKUP_PATHNAME = ( pathname ) => {
  const backupFilename = 'tmp' + pathname.replace( /[\/\.]/g, '-' ) + process.pid.toString() ; // Convert slashes and dots to dashes
  const backupPathname = path.join( BACKUP_DIR, backupFilename ) ;
  return backupPathname ;
} ;

/**
 * @param {string} readmePathname : the readme file pathname that is in the same directory as the package.json
 * @returns the package.json pathhame.
 */
function genPackagePathname( readmePathname ) {
  let dirname = path.dirname( readmePathname ) ;
  const outputPathname = path.resolve( dirname, PACKAGE_FILENAME ) ;
  return outputPathname ;
}

/**
 * @param {string} pathname : a file pathname
 * @returns the file contents.
 * @exception if the file cannot be read.
 */
function readFile( pathname ) {
  let fileContent = null ;

  if ( ! pathname ) {
    throw new Error( 'No pathname specified' ) ;
  }

  if ( fs.existsSync( pathname ) ) {
    fileContent = fs.readFileSync( pathname, { encoding: 'utf-8' } ) ;
  } else {
    throw new Error( `File not found: ${pathname}` ) ;
  }

  return fileContent ;
}

/**
 * Delete a file, making a backup of it first.
 * @param {string} pathname : a file pathname.
 * @exception of the file cannot be deleted.
 */
async function deleteFile( pathname ) {
  const backupPathname = BACKUP_PATHNAME( pathname ) ;
  fs.copyFileSync( pathname, backupPathname ) ;
  console.log( `Backup file created: ${backupPathname}` ) ;
  await fsp.unlink( pathname ) ;
}

/**
 * @param {string} pathname : file pathname to write to;
 * @param {string} content  : text to write to the file as UTF-8.
 * @exception if the file creation fails.
 */
function writeFile( pathname, content ) {
  fs.writeFileSync( pathname, content, { encoding: 'utf-8' } ) ;
  console.log( `File created: ${pathname}` ) ;
}

/**
 * @param {string} pathname   : file pathname to create;
 * @param {Object} rawContent : object to be stringified and written to the file.
 */
function writeFileJSON( pathname, rawContent ) {
  const cookedContent = JSON.stringify( rawContent, null, 2 ) ;
  writeFile( pathname, cookedContent ) ;
}

/**
 * @param {string} packagePathname : pathname to the package.json file.
 * @returns the contents of the package file as an object.
 * @exception if the the package file cannot be loaded.
 */
function loadPackage( packagePathname ) {
  const packageContent = require( packagePathname ) ;
  return packageContent ;
}

/**
 * @param {Object} with properties:
 *          - packagePathname : pathname to the package.json file;
 *          - readmeText      : the README markdown as a string.
 */
async function updatePackage( { packagePathname, readmeText } ) {
  const packageObj  = require( packagePathname ) ;
  packageObj.readme = readmeText ;
  await deleteFile( packagePathname ) ;
  writeFileJSON( packagePathname, packageObj ) ;
}

/**
 * Can remove this once we move to node.js 16
 * @param {string} strRaw          : the source string;
 * @param {string/regex} strSearch : search for this;
 * @param {string} strReplace      : replace with this.
 * @returns the source string with all occurrences of the search string/regex replaced.
 */
function replaceAll( strRaw, strSearch, strReplace ) {
  let strPrev ;
  let strCurr = strRaw ;

  do {
    strPrev = strCurr ;
    strCurr = strPrev.replace( strSearch, strReplace ) ;
  } while ( strPrev !== strCurr ) ;

  return strCurr ;
}

/**
 * @param {string} rawContent : the markdown;
 * @param {RegExp} regex      : regex to search for, must have the global option set;
 * @param {string} tagPrefix  : use this text in the tag name.
 * @returns object with properties:
 *           - tags         : object with properties being the tag names and values being the tag replacements;
 *           - cookedContent: the markdown with all regexes replaced with tags.
 */
function encodeTags( rawContent, regex, tagPrefix ) {
  let   cookedContent = rawContent ;
  const re            = regex ;
  const matchResult   = rawContent.match( re );
  const tags          = {} ;
  for ( let i = 0 ; i < matchResult?.length; ++i ) {
    const tag = '!TAG!' + tagPrefix + String(i).padStart( 2, '0' ) ;
    const strSearch = matchResult[ i ] ;
    tags[ tag ]     = strSearch ;
    cookedContent   = replaceAll( cookedContent, strSearch, tag ) ;
  }
  return { tags, cookedContent } ;
}

/**
 * @param {string} rawContent : the markdown;
 * @returns object with properties:
 *       - tags          : object with properties being the tags and values being the associated text;
 *       - cookedContent : the markdown with any preformatted sections replaced with tags.
 */
function encodeTagsPreformatted( rawContent ) {
  const re        = new RegExp( '<pre>.*?</pre>', 'ig' ) ;
  const tagPrefix = 'PREF' ;
  const { tags, cookedContent } = encodeTags( rawContent, re, tagPrefix ) ;
  return { tags, cookedContent } ;
}

/**
 * @param {string} rawContent : the markdown;
 * @returns object with properties:
 *       - tags          : object with properties being the tags and values being the associated text;
 *       - cookedContent : the markdown with any internal hyperlinks replaced with tags.
 */
 function encodeTagsLinks( rawContent ) {
  const re        = new RegExp( '\\[[^\\]\n\r]+\]\\(#[^)\n\r]+\\)', 'g' ) ;
  const tagPrefix = 'LINK' ;
  const { tags, cookedContent } = encodeTags( rawContent, re, tagPrefix ) ;
  return { tags, cookedContent } ;
}

/**
 * @param {string} rawContent : the markdown encoded with tags;
 * @param {Object} tags       : object with properties being the tags and values being the associated text;
 * @returns the markdown with the tags replaced with the associated text.
 */
function decodeTags( rawContent, tags ) {
  let cookedContent = rawContent ;

  Object.entries( tags ).forEach( ( [ strSearch, strReplace ] ) => {
    cookedContent = replaceAll( cookedContent, strSearch, strReplace ) ;
  } ) ;

  return cookedContent ;
}

/**
 * @param {string} rawLink  : an internal hyperlink, e.g., [My Link](#to-the-link) ;
 * @param {string} baseHref : absolute HTTP address to the Verdaccio README page of this module.
 * @returns the internal hyperlink modified to reference the absolute HTTP address in Verdaccio.
 */
function genFixedLink( rawLink, baseHref ) {
  const cookedLink = rawLink.replace( '(#', `(${baseHref}#` ) ;
  return cookedLink ;
}

/**
 * @param {string} rawReadmeText : the markdown;
 * @param {string} baseHref      : absolute HTTP address to the Verdaccio README page of this module.
 * @returns the markdown with the internal hyperlinks updated to refer to the Verdaccio Web UI page for the module.
 */
function fixLinks( rawReadmeText, baseHref ) {
  const { tags: tagsPreformatted, cookedContent: cookedContentPreformatted } = encodeTagsPreformatted( rawReadmeText ) ;
  const { tags: tagsLinks,        cookedContent: cookedContentLinks }        = encodeTagsLinks( cookedContentPreformatted ) ;
  let cookedContent = cookedContentLinks ;

  Object.entries( tagsLinks ).forEach( ( [ tag, rawLink ] ) => { 
    tagsLinks[ tag ] = genFixedLink( rawLink, baseHref ) ;
  } ) ;

  cookedContent = decodeTags( cookedContent, tagsPreformatted ) ;
  cookedContent = decodeTags( cookedContent, tagsLinks ) ;

  return cookedContent ;
}

/**
 * @param {Object} packageContent : the package.json file as an object;
 * @returns object with properties:
 *           - baseHref     : absolute HTTP address to the Verdaccio README page of the module;
 *           - baseHrefText : the base HTML tag containing the baseHref, e.g., <base href="https://verdaccio....">
 */
function genBaseHref( packageContent ) {
  const registry     = packageContent?.publishConfig?.registry || DEFAULT_REGISTRY ;
  const packageName  = packageContent.name ;
  const baseHref     = `${registry}${REL_WEB_PATH}${packageName}?` ;
  const baseHrefText = `<base href="${baseHref}">` ;
  return { baseHref, baseHrefText } ;
}

/**
 * @param {Object} object with properties:
 *          - packageContent : contents of the package.json file;
 *          - rawReadmeText  : the markdown;
 * @returns the markdown with the internal hyperlinks fixed.
 */
function fixReadmeText( { packageContent, rawReadmeText } ) {
  const { baseHref } = genBaseHref( packageContent ) ;
  const cookedReadmeText = fixLinks( rawReadmeText, baseHref ) ;
  return cookedReadmeText ;
}

/**
 * Update the package.json file with the contents of the README.md file.
 * @param {Object} readmePathname : pathname to the README.md file to process.
 */
async function run( readmePathname ) {
  const rawReadmeText   = readFile( readmePathname ) ;
  const packagePathname = genPackagePathname( readmePathname ) ;
  const packageContent  = loadPackage( packagePathname ) ;
  const readmeText      = fixReadmeText( { rawReadmeText, packageContent } ) ;
  await updatePackage( { packagePathname, readmeText } ) ;
}

const pathname = process.argv[ 2 ] || DEFAULT_README_PATHNAME ;

run( pathname )
.then()
.catch( err => {
  console.log( `ERROR: ${err.message}` ) ;
} ) ;
