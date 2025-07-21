const fs = require('fs');
const path = require('path');
const AnkiExport = require('anki-apkg-export').default;

class AnkiParser {
    constructor(filepath) {
        this.filepath = filepath;
        this.content = this._readFile(this.filepath)
    }

    _readFile() {
        try {
            const content = fs.readFileSync(this.filepath, 'utf8');
            return content;
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    parseCards() {
        const calloutRegex = />\[!anki\]\s*(.+?)\n((?:>.*\n?)*)/g;
        this.questions = [];

        let match;
        while ((match = calloutRegex.exec(this.content)) !== null) {
            const question = match[1].trim();
            const answer = match[2]
                .split('\n')
                .map(line => line.replace(/^>/, ''))
                .filter(line => line.length > 0)
                .join('\n');
            
            this.questions.push({ q: question, a: answer });
        }

        return this.questions;
    }

    createCards(deckName = 'Generated Deck', outputPath = './output.apkg') {
        if (!this.questions || this.questions.length === 0) {
            throw new Error('No cards found. Run parseCards() first.');
        }

        const apkg = new AnkiExport(deckName);

        this.questions.forEach(card => {
            apkg.addCard(card.q, card.a);
        });

        return apkg.save()
            .then(zip => {
                fs.writeFileSync(outputPath, zip, 'binary');
                console.log(`Package has been generated: ${outputPath}`);
                return outputPath;
            })
            .catch(err => {
                throw new Error(`Failed to create Anki package: ${err.message}`);
            });
    }
}

function main() {
    const a = new AnkiParser("/Users/peter/Library/Mobile Documents/iCloud~md~obsidian/Documents/Main/Klausurvorbereitung/sem2/ethik/Ankikarten - Ethik.md")
    const q = a.parseCards()
    console.log(q)
    
    // Create Anki package
    a.createCards('Ethik Deck', './ethik-cards.apkg')
        .then(path => console.log(`Created: ${path}`))
        .catch(err => console.error(err.message));
}

main()