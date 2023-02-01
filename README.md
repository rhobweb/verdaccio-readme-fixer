# Overview

The module formats internal hyperlinks for this page so that they work under Verdaccio.
<br>Verdaccio puts the README.md contents into the package.json as a "readme" property.
<br>This module fixes the internal hyperlinks and updates the package.json "readme" property.

# Usage

<pre>node this_module_path/readme-fixer.js [readmeFile]</pre>

Where:
  - [readmeFile] : is the pathname of the markdown file to process. If not specified, defaults to "README.md" in the current directory.

# README.md file

Internal hyperlinks such as the following are converted to internal hyperlinks on the Verdaccio Web UI page:

<pre>[Example Link for Testing](#example-link-for-testing)</pre>

# Output

The package.json file is updated with the README text.
<br>If successful, the console output should look something like:

<pre>
Backup file created: /tmp/tmp-opt-modules-@rhobweb-js-verdaccio-readme-fixer-package-json.73543
File created: /opt/modules/@rhobweb.js/verdaccio-readme-fixer/package.json
</pre>

# Example Link for Testing

[README.md file](#readmemd-file)
