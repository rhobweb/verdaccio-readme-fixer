/**
 * Script to fix Verdaccio README.md files.
 * See 'readme-fixer.js' for details.
 */
'use strict';

const readmeFixer = require( './readme-fixer' );

// No point in fancy argument parsing, just check whether the last argument ends in '.md'
const lastArg        = process.argv[ process.argv.length - 1 ];
const readmePathname = ( lastArg.match( /\.md$/i ) ? lastArg : undefined );

readmeFixer.processReadme( readmePathname )
.then( ( { packagePathname, backupPackagePathname } ) => {
  console.log( `Backup package file created: ${backupPackagePathname}` );
  console.log( `Package file readme updated: ${packagePathname}` );
} )
.catch( err => {
  console.log( `ERROR: ${err.message}` );
} );
