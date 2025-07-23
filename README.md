# Peters Obsidian Plugins

Monorepo of my various obsidian extensions for studying CS.

They are mostly for personal use, so I won't do any support unless stated otherwise.

You can install them like this, after cloning this repo:

```sh
$ ./install.sh {plugin} "{path-to-obsidian-vault}"
# Example: ./install.sh anki-exporter "/Users/peet/Library/Mobile Documents/iCloud~md~obsidian/Documents/Main"
```

## AI-Plugin

A Gemini AI-Studio integration. Able to upload files as context, save a cache ID in a file and reuse that to ask questions to a whole folder.

## Sokrates-Plugin

An integration for a university-internal AI math tutor (https://app.sokrates.ae.org/)

## Anki-Exporter

Adds support for a new `>[!anki]` callout and a command, to export all callouts of the current file to an .apkg file.
