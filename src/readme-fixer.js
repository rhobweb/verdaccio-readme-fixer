/**
 * Utilities to fix Verdaccio README.md files.
 * Verdaccio: A lightweight private npm proxy registry. See https://www.npmjs.com/~verdaccio.npm.
 *
 * When first published to Verdaccio, it packs the README.md into the package.json file.
 * However, on subsequent publishing the README.md is not packaged package.json file. 
 *
 * This utility updates the package.json file with the packed README.md file.
 *
 * Internal hyperlinks don't appear to work under Verdaccio.
 * Internal hyperlinks are updated to contain absolute hyperlinks to the Verdaccio registry.
 */
'use strict';

const path = require( 'path' );
const fs   = require( 'fs' );
const fsp  = require( 'fs/promises' );

const DEFAULT_README_PATHNAME = './README.md';           // Use this if no pathname specified on the command line
const DEFAULT_REGISTRY        = 'http://localhost:4873'; // Use this if the package.json does not contain a publishConfig.registry.
const REL_WEB_PATH            = '/-/web/detail/';        // The Verdaccio Web UI path to the README pages
const PACKAGE_FILENAME        = 'package.json';
const BACKUP_DIR              = ( process.platform === 'win32' ? 'C:\\Temp' : '/tmp' );

/**
 * @param {string} pathname : a file pathname
 * @returns a unique absolute pathname to backup the file to.
 */
function genBackupPathname( pathname ) {
  const pid            = process.pid.toString();
  const backupFilename = 'tmp-' + pathname.replace( /[\\/.:]/g, '-' ) + '.' + pid; // Convert slashes, backslashes, dots and colons to dashes
  const backupPathname = path.join( BACKUP_DIR, backupFilename );
  return backupPathname;
}

/**
 * @param {string} readmePathname : the readme file pathname that is in the same directory as the package.json
 * @returns the package.json pathhame.
 */
function genPackagePathname( readmePathname ) {
  let dirname = path.dirname( readmePathname );
  const outputPathname = path.resolve( dirname, PACKAGE_FILENAME );
  return outputPathname;
}

/**
 * @param {string} pathname : a file pathname
 * @returns the file contents.
 * @exception if the file cannot be read.
 */
function readFile( pathname ) {
  let fileContent = null;

  if ( ! pathname ) {
    throw new Error( 'No pathname specified' );
  }

  if ( fs.existsSync( pathname ) ) {
    fileContent = fs.readFileSync( pathname, { encoding: 'utf-8' } );
  } else {
    throw new Error( `File not found: ${pathname}` );
  }

  return fileContent;
}

/**
 * Delete a file, making a backup of it first.
 * @param {string} pathname : a file pathname.
 * @exception of the file cannot be deleted.
 * @return object with property: backupPathname - a backup of the deleted file.
 */
async function deleteFile( pathname ) {
  const backupPathname = genBackupPathname( pathname );
  fs.copyFileSync( pathname, backupPathname );
  await fsp.unlink( pathname );
  return { backupPathname };
}

/**
 * @param {string} pathname : file pathname to write to;
 * @param {string} content  : text to write to the file as UTF-8.
 * @exception if the file creation fails.
 */
function writeFile( pathname, content ) {
  fs.writeFileSync( pathname, content, { encoding: 'utf-8' } );
}

/**
 * @param {string} pathname   : file pathname to create;
 * @param {Object} rawContent : object to be stringified and written to the file.
 */
function writeFileJSON( pathname, rawContent ) {
  const cookedContent = JSON.stringify( rawContent, null, 2 );
  writeFile( pathname, cookedContent );
}

/**
 * @param {string} packagePathname : pathname to the package.json file.
 * @returns the contents of the package file as an object.
 * @exception if the the package file cannot be loaded.
 */
function loadPackage( packagePathname ) {
  const packageContent = require( packagePathname );
  return packageContent;
}

/**
 * @param {Object} with properties:
 *          - packagePathname : pathname to the package.json file;
 *          - readmeText      : the README markdown as a string.
 * @return object with property: backupPackagePathname - a backup of the original package file.
 */
async function updatePackage( { packagePathname, readmeText } ) {
  const packageObj  = loadPackage( packagePathname );
  packageObj.readme = readmeText;
  const { backupPathname: backupPackagePathname } = await deleteFile( packagePathname );
  writeFileJSON( packagePathname, packageObj );
  return { backupPackagePathname };
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
  let   cookedContent = rawContent;
  const matchResult   = rawContent.match( regex );
  const tags          = {};
  for ( let i = 0; i < matchResult?.length; ++i ) {
    const tag       = '!TAG!' + tagPrefix + String(i).padStart( 2, '0' );
    const strSearch = matchResult[ i ];
    tags[ tag ]     = strSearch;
    cookedContent   = cookedContent.replaceAll( strSearch, tag );
  }
  return { tags, cookedContent };
}

/**
 * @param {string} rawContent : the markdown;
 * @returns object with properties:
 *       - tags          : object with properties being the tags and values being the associated text;
 *       - cookedContent : the markdown with any preformatted sections replaced with tags.
 */
function encodeTagsPreformatted( rawContent ) {
  const re        = new RegExp( '<pre>.*?</pre>', 'ig' );
  const tagPrefix = 'PREF';
  return encodeTags( rawContent, re, tagPrefix );
}

/**
 * @param {string} rawContent : the markdown;
 * @returns object with properties:
 *       - tags          : object with properties being the tags and values being the associated text;
 *       - cookedContent : the markdown with any internal hyperlinks replaced with tags.
 */
function encodeTagsLinks( rawContent ) {
  const re        = new RegExp( '\\[[^\\]\n\r]+\\]\\(#[^)\n\r]+\\)', 'g' ); // eslint-disable-line no-control-regex
  const tagPrefix = 'LINK';
  return encodeTags( rawContent, re, tagPrefix );
}

/**
 * @param {string} encodedContent : the markdown encoded with tags;
 * @param {Object} tags           : object with properties being the tags and values being the associated text;
 * @returns the markdown with the tags replaced with the associated text.
 */
function decodeTags( encodedContent, tags ) {
  let decodedContent = encodedContent;

  Object.entries( tags ).forEach( ( [ strSearch, strReplace ] ) => {
    decodedContent = decodedContent.replaceAll( strSearch, strReplace );
  } );

  return decodedContent;
}

/**
 * @param {string} rawLink  : an internal hyperlink, e.g., [My Link](#to-the-link);
 * @param {string} baseHref : absolute HTTP address to the Verdaccio README page of this module.
 * @returns the internal hyperlink modified to reference the absolute HTTP address in Verdaccio.
 */
function genFixedLink( rawLink, baseHref ) {
  return rawLink.replace( '(#', `(${baseHref}#` );
}

/**
 * @param {string} rawReadmeText : the markdown;
 * @param {string} baseHref      : absolute HTTP address to the Verdaccio README page of this module.
 * @returns the markdown with the internal hyperlinks updated to refer to the Verdaccio Web UI page for the module.
 */
function fixLinks( rawReadmeText, baseHref ) {
  const { tags: tagsPreformatted, cookedContent: cookedContentPreformatted } = encodeTagsPreformatted( rawReadmeText );
  const { tags: tagsLinks,        cookedContent: cookedContentLinks }        = encodeTagsLinks( cookedContentPreformatted );
  let cookedContent = cookedContentLinks;

  Object.entries( tagsLinks ).forEach( ( [ tag, rawLink ] ) => { 
    tagsLinks[ tag ] = genFixedLink( rawLink, baseHref );
  } );

  cookedContent = decodeTags( cookedContent, tagsLinks );
  cookedContent = decodeTags( cookedContent, tagsPreformatted );

  return cookedContent;
}

/**
 * @param {Object} packageContent : the package.json file as an object;
 * @returns object with properties:
 *           - baseHref     : absolute HTTP address to the Verdaccio README page of the module;
 *           - baseHrefText : the base HTML tag containing the baseHref, e.g., <base href="https://verdaccio....">
 */
function genBaseHref( packageContent ) {
  const registry     = packageContent?.publishConfig?.registry || DEFAULT_REGISTRY;
  const packageName  = packageContent.name;
  const baseHref     = `${registry}${REL_WEB_PATH}${packageName}?`;
  const baseHrefText = `<base href="${baseHref}">`;
  return { baseHref, baseHrefText };
}

/**
 * @param {Object} object with properties:
 *          - packageContent : contents of the package.json file;
 *          - rawReadmeText  : the markdown;
 * @returns the markdown with the internal hyperlinks fixed.
 */
function fixReadmeText( { packageContent, rawReadmeText } ) {
  const { baseHref } = genBaseHref( packageContent );
  return fixLinks( rawReadmeText, baseHref );
}

/**
 * Update the package.json file with the contents of the README.md file.
 * @param {Object} readmePathname : pathname to the README.md file to process.
 * @return object with properties:
 *          - packagePathname       : the pathname of the package file that has been updated; 
 *          - backupPackagePathname : a backup of the original package file.
 * @exception if an error occurred.
 */
async function processReadme( readmePathname = DEFAULT_README_PATHNAME ) {
  const rawReadmeText    = readFile( readmePathname );
  const packagePathname  = genPackagePathname( readmePathname );
  const packageContent   = loadPackage( packagePathname );
  const readmeText       = fixReadmeText( { rawReadmeText, packageContent } );
  const result           = await updatePackage( { packagePathname, readmeText } );
  result.packagePathname = packagePathname;
  return result;
}

module.exports = {
  processReadme,
};
