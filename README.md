# Zendown

ZenDown is a minimalist self-hostable markdown note taking app. ZenDown features a local ai-engine that generates document embeddings for semantic search and automatic related notes based on a similarity score.

ZenDown is ideal for frictionless zettelkasten as it removes the need for manually linking related notes. Related notes are automatically listed for each note. This reduces the cognitive burden of figuring out and connecting related content manually.

Find any note based on semantic meaning. Instead of string based pattern matching search ZenDown understands and searches notes based on the semantic meaning of the query.

## Philosophy

Despite there being several note taking apps, as someone with ADHD, I find the customizability and too many features very distracting (gets me down a rabbit hole ending up in setup-paralalysis - Looking at you Obsidian). I was looking for a simple note taking app that helps me focus on note taking with a minimal opinionated set of features. An important requirement is for all data and processing to happen locally on my own device.

As someone who suffers from cognitive overload and dissonance, I wanted to remove the cognitive cost associated with organizing notes to make knowledge retrieval straight forward. So I leverage locally running Machine Learning models for addressing this. Loosely based on the zettelkasten system, the ML models make it trivial to find any content two ways:

* First, it allows searching documents by contextual meaning of the query sentence instead of string pattern matching
* Second, for any note we automatically find and list all notes that are *semantically* similar so you can readily see all notes related to a topic

This makes implementing zettelkasten trivial as you no longer need to manually link notes.
Going forward the app will focus on a core set of opinionated features with a strong emphasis on ML/AI based automation for note taking related problems. Of course all ML/AI will be fully local. Checkout the Roadmap section for some of the features planned.

## Features

* full markdown syntax support including callouts, latex equations and mermaid diagrams
* Also supports block based rich text editing alternative
* Zen mode allows distraction free writing
* Semantic search based on actual meaning
* Automatic listing of related notes using document embeddings
* Mobile friendly and responsive design allows you to use on any device
* Minimal and uncluttered UI that keeps things simple and easy
* Fast and lightweight editor that remains performant when handling long notes
* Markdown live preview mode renders markdown while editing
* Preview mode to render markdown
* Keyboard shortcuts for most UI interactions for a fluid experience

## Installation

ZenDown is available as a docker image and can be deployed with the docker-compose provided below.

````compose
services:
  zendown-ai:
    image: ghcr.io/rishikanthc/zendown-ai:v0.1.0
    volumes:
      - ./db:/db # This volume is for zendown-ai's own database
    restart: unless-stopped

  zendown:
    image: ghcr.io/rishikanthc/zendown:v0.1.4
    ports:
      - "3000:3000"
    volumes:
      - ./zendown_db_data:/db
    environment:
      - AI_SERVER_URL=http://zendown-ai:8000
    depends_on:
      - zendown-ai
    restart: unless-stopped
````

## Roadmap

I currently planning to build the following features just to give an idea of the direction the project is headed in. I’m open to feature requests if they solve a meaningful problem in note taking:

* Support for uploading images
* Tag based organization
* Automatic summarization of notes
* Querying system to support [dataview](https://blacksmithgu.github.io/obsidian-dataview/) like queries
* Learning to auto-tag notes from note data
* PWA support

# Contributing

Contributions are most welcome!
If you have any cool ideas / request for features / any issues please open an
issue in the issue tracker and I’ll get back to you as soon as possible.
Please follow these steps to contribute to development:

1. Fork the repository.
1. Create a feature branch (git checkout -b feature/my-cool-feature).
1. Commit your changes (git commit -m “Add awesome feature”).
1. Push to your branch (git push origin feature/my-cool-feature).
1. Open a Pull Request, describing the change and any setup steps.

# License

This project is licensed under the GNU AGPL License. See LICENSE file for details.

