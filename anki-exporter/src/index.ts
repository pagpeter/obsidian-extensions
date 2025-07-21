import * as fs from "fs";
import * as path from "path";
import AnkiExport from "anki-apkg-export";

interface AnkiCard {
  q: string;
  a: string;
}

class AnkiParser {
  private filepath: string;
  private content: string;
  private questions: AnkiCard[] = [];

  constructor(filepath: string) {
    this.filepath = filepath;
    this.content = this._readFile();
  }

  private _readFile(): string {
    try {
      const content = fs.readFileSync(this.filepath, "utf8");
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  }

  parseCards(): AnkiCard[] {
    const calloutRegex = />\[!anki\]\s*(.+?)\n((?:>.*\n?)*)/g;
    this.questions = [];

    let match;
    while ((match = calloutRegex.exec(this.content)) !== null) {
      const question = match[1].trim();
      const answer = match[2]
        .split("\n")
        .map((line) => line.replace(/^>/, ""))
        .filter((line) => line.length > 0)
        .join("\n");

      this.questions.push({ q: question, a: answer });
    }

    return this.questions;
  }

  async createCards(
    deckName: string = "Generated Deck",
    outputPath: string = "./output.apkg"
  ): Promise<string> {
    if (!this.questions || this.questions.length === 0) {
      throw new Error("No cards found. Run parseCards() first.");
    }

    const apkg = AnkiExport(deckName);

    this.questions.forEach((card) => {
      apkg.addCard(card.q, card.a);
    });

    try {
      const zip = await apkg.save();
      fs.writeFileSync(outputPath, zip, "binary");
      console.log(`Package has been generated: ${outputPath}`);
      return outputPath;
    } catch (err) {
      throw new Error(
        `Failed to create Anki package: ${(err as Error).message}`
      );
    }
  }
}

async function main(): Promise<void> {
  const a = new AnkiParser(
    "/Users/peter/Library/Mobile Documents/iCloud~md~obsidian/Documents/Main/Klausurvorbereitung/sem2/ethik/Ankikarten - Ethik.md"
  );
  const q = a.parseCards();
  console.log(q);

  try {
    const path = await a.createCards("Ethik Deck", "./ethik-cards.apkg");
    console.log(`Created: ${path}`);
  } catch (err) {
    console.error((err as Error).message);
  }
}

main();
