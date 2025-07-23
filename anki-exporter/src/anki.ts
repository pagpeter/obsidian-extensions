interface AnkiCard {
	q: string;
	a: string;
}

class AnkiParser {
	private content: string;
	private questions: AnkiCard[] = [];

	constructor(content: string) {
		this.content = content;
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
				.join("\n")
				.replace(/\n/g, "<br>")
				.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

			this.questions.push({ q: question, a: answer });
		}

		return this.questions;
	}
}

export { AnkiParser };
