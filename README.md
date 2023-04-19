# Overview

The module formats internal hyperlinks for this page so that they work under Verdaccio.
<br>Verdaccio puts the README.md contents into the package.json as a "readme" property.
<br>This module fixes the internal hyperlinks and updates the package.json "readme" property.
<br>Must be run from the directory containing the package.json file to be updated.

## Usage

<pre>node <i>this_module_path</i> [readmeFile]</pre>

<pre>node ./@rhoweb.js/verdaccio-readme-fixer ./README.md</pre>


Where:
  - [readmeFile] : is the pathname of the markdown file to process. If not specified or does not have a '.md' extension, defaults to "README.md" in the current directory.

## README.md file

Internal hyperlinks such as the following are converted to internal hyperlinks on the Verdaccio Web UI page:

<pre>[Example Link for Testing](#example-link-for-testing)</pre>

## Output

The package.json file is updated with the README text.
<br>If successful, the console output should look something like:

<pre>
Backup package file created: /tmp/tmp-opt-modules-@rhoweb-js-verdaccio-readme-fixer-package-json.73543
Package file readme updated: /opt/modules/@rhoweb.js/verdaccio-readme-fixer/package.json
</pre>

## Example Link for Testing

[README.md file](#readmemd-file)

# Testing

The unit tests may be run from [VS Code](https://code.visualstudio.com/) or from the command line by:

1. Change directory to the module root directory, e.g., <pre>cd ./@rhoweb.js/verdaccio-readme-fixer</pre>
1. Run unit tests: <pre>npm run test-unit</pre>
1. Run unit test coverage: <pre>npm run test-coverage</pre>
