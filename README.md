# Consistent Attachments and Links

The plugin for [Obsidian](https://obsidian.md/) allows you to reorganize your vault to make it more consistent. Next, the plugin will automatically maintain the consistency of your library.
<br>

⚠️⚠️⚠️ Be sure to backup your library before using the plugin for the first time! ⚠️⚠️⚠️

## What's the idea

The idea is to have all links between notes and attachments in strict accordance with the markdown format and support their relative paths. This is useful when you want to open a note in another program that does not know where your vault folder is, or for example you want to publish and read your notes on GitHub or another site that allows you to upload markdown files and you need compatibility.

Ideally, all attachments should be located in the note folder or its subfolders. It is not necessary, but in this case, you can easily export a note to a separate folder outside of your vault, knowing that all its attachments are with it. By deleting a note, you will know for sure that you will not delete the attachments you need or leave unnecessary garbage in your library.

If you store attachments in a folder with a note or its subfolders, the plugin will automatically move\delete attachments when you move or delete a note.
<br>

## Disclaimer

**Please backup your library before using this plugin! Once converted links cannot be converted back.**

**To use this plugin, you will have to give up all the proprietary things that Obsidian uses in the link format.**

Obsidian has a very clever file link search, but this can be a problem for you if you want your notes to be compatible with other programs. This is the main point of the plugin.

If you still want to have link compatibility with some Obsidian features, write a feature request to the [github repository](https://github.com/derwish-pro/obsidian-consistent-attachments-and-links/issues) of this plugin.
<br>

## How to configure Obsidian

Required Obsidian settings for the plugin to work properly:

- **"Files & Links > Automatically update internal links": disabled.** The plugin itself is responsible for updating the links. When Obsidian shows a dialog asking to update links, refuse.

- **"New link format": Relative path to file.** Otherwise, strict compliance of the links cannot be guaranteed.

- **"Use \[\[Wikilinks\]\]": disabled**. Wikilinks are not a markdown standard.

Recommended additional settings (not required for the plugin to work):

- **"Default location for new attachments":In subfolder under current folder**. This is not required, but this ensures that attachments are always next to your notes. The option "Same folder as current file" is also suitable.

- To improve performance, consider installing [Backlink Cache](https://obsidian.md/plugins?id=backlink-cache) plugin.

## `Attachment Subfolder` setting <span id="attachment-subfolder-setting"></span>

Starting from [v3.0.0](https://github.com/dy-sh/obsidian-consistent-attachments-and-links/releases/tag/3.0.0) `Attachment Subfolder` setting is no longer managed by the plugin.

Currently the plugin relies on built-in Obsidian's `Default location for new attachment` setting.

If you need better control over the attachment folder, consider [Obsidian Custom Attachment location](https://obsidian.md/plugins?id=obsidian-custom-attachment-location) plugin.

## How to check the consistency of the library

Run "Check Vault Consistency" command and see the report.

## How to achieve consistency of an existing library

> It is very important to make a backup of the entire vault folder before these steps.

Configure [`Attachment Subfolder` setting](#attachment-subfolder-setting).

Run the commands in the following order to reorganize vault:

- Replace All Wiki Links with Markdown Links
- Convert All Embed Paths to Relative
- Convert All Link Paths to Relative
- Rename All Attachments (using Unique attachments plugin, optional)
- Collect All Attachments
- Delete Empty Folders

Or just run "Reorganize Vault" command, then rename all attachments using Unique attachments (optional)

You can look at the console log to make sure everything worked out without errors. Errors can point to broken links (paths to files that no longer exist).
<br>

## How this plugin helps maintain consistency

When you move a note in Obsidian, the plugin checks if attachments need to be moved and links updated. If attachments are in a folder with a note or subfolders, then the plugin moves the attachments along with the note.

It does this safely, making sure not to move attachments that are referenced by other notes. If you move a note with attachments that are used in other notes, the plugin automatically creates a copy of this files and redirects the moved note to them.

If you move a note to a folder where there are already attachments with the same names, the plugin
can work in two modes, depending on "**Delete Duplicate Attachments on Note Move**" setting:

- **Disabled**: Duplicate files will be renamed (new names are generated), and then moved to a new folder with a note.
- **Enabled**: It will remove the duplicate files that you move, leaving the ones that are already in the target folder. This is useful if you have unique names for all attachments. You can use [Unique attachments](https://github.com/derwish-pro/obsidian-unique-attachments) plugin which renames attachments by generating file names based on hashing of file content (it's great to use both of these plugins in conjunction with this option enabled).

When deleting a note, the plugin can delete all attachments that are no longer in use. This option can be disabled.

The plugin is also able to automatically delete empty folders that result from moving files, as well as update the text of links when renaming notes (optionally).
<br>

## Commands

The plugin has the following commands that you can call:
<br>

### Check Vault Consistency

Check if there are vault consistency problems and print the report. The report will contain:

- Bad links
- Bad embed paths
- Wiki-links
- Wiki-embeds

### Reorganize Vault

Runs the following commands one by one:

- Replace All Wiki Links with Markdown Links
- Convert All Embed Paths to Relative
- Convert All Link Paths to Relative
- Collect All Attachments
- Delete Empty Folders

This is the fastest way to clean up your library.
<br>

### Replace All Wiki Links with Markdown Links

Searches for all wiki links in notes and converts them into regular markdown links.

Example:
`[[readme]]`
will turn into this:
`[readme](readme.md)`
<br>

### Convert All Embed Paths to Relative

Searches for all embeds in notes and converts their paths to relative format.

Example:
`![](title.png)`
will turn into this:
`![](../attachments/title.png)`

This is one of the most important steps on the road to consistency, ensuring that all embed links now point to the correct files accurately.
<br>

### Convert All Link Paths to Relative

Does the same as "Convert all embed paths to relative" for links.

Example:
`[](readme.md)`
will turn into this:
`[](../readme.md)`
<br>

### Collect All Attachments

The plugin finds all the notes and moves all attachments in the note folder. This is useful if you are not sure if all attachments are in your notes folders and you want to clean up your library. It relies on [`Attachment Subfolder` setting](#attachment-subfolder-setting).

### Delete Empty Folders

Removes all empty folders in your library.

## Installation

- `Consistent Attachments and Links` is available in [the official Community Plugins repository](https://obsidian.md/plugins?id=consistent-attachments-and-links).
- Beta releases can be installed through [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).

© [dy-sh](https://github.com/dy-sh/)
