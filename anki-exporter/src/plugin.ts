import {
	Notice,
	Plugin,
	TFolder,
	TFile,
	Menu,
	Modal,
	Setting,
	requestUrl,
} from "obsidian";
import { AnkiParser } from "./anki";

interface MyPluginSettings {
	ankiConnectUrl: string;
}

type Card = {
	deckName: string;
	modelName: string;
	fields: {
		Front: string;
		Back: string;
	};
	tags: string[];
};

const DEFAULT_SETTINGS: MyPluginSettings = {
	ankiConnectUrl: "http://127.0.0.1:8765",
};

class AnkiSyncModal extends Modal {
	private folderName: string;
	private inputDeckName: string = "";
	private onSubmit: (deckName: string) => void;

	constructor(
		app: any,
		folderName: string,
		onSubmit: (deckName: string) => void
	) {
		super(app);
		this.folderName = folderName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: `Sync Anki cards for "${this.folderName}"`,
		});

		new Setting(contentEl)
			.setName("Deck name")
			.setDesc("Enter the name for the Anki deck")
			.addText((text) =>
				text
					.setPlaceholder("Enter deck name...")
					.setValue(this.inputDeckName || this.folderName)
					.onChange((value) => {
						this.inputDeckName = value;
					})
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Submit")
					.setCta()
					.onClick(() => {
						if (this.inputDeckName.trim()) {
							this.onSubmit(this.inputDeckName.trim());
							this.close();
						} else {
							new Notice("Please enter a deck name");
						}
					})
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default class AnkiExporterPlugin extends Plugin {
	settings: MyPluginSettings;

	constructor(app: any, manifest: any) {
		super(app, manifest);
	}

	async addCards(cards: Card[]) {
		const results = [];

		for (const card of cards) {
			const requestBody = {
				action: "addNote",
				version: 6,
				params: { note: card },
			};

			try {
				const response = await requestUrl({
					url: this.settings.ankiConnectUrl,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				});

				if (response.json.error) {
					throw new Error(response.json.error);
				}

				results.push(response.json.result);
			} catch (error) {
				throw new Error(`Anki Connect request failed: ${error}`);
			}
		}

		return results;
	}

	async syncFolderToAnki(folder: TFolder, deckName: string) {
		try {
			let totalCards = 0;
			const allCards: { q: string; a: string; fileName: string }[] = [];

			// Get all markdown files in the folder (including subfolders)
			const files = this.getAllMarkdownFiles(folder);

			if (files.length === 0) {
				new Notice("No markdown files found in the folder");
				return;
			}

			new Notice(`Processing ${files.length} files...`);

			// First, read all cards from all files
			for (const file of files) {
				try {
					// Get file path and read content
					const content = await this.app.vault.read(file);

					// Create a temporary AnkiParser instance
					const parser = new AnkiParser(content);
					const cards = parser.parseCards();
					console.log(cards);

					if (cards.length > 0) {
						// Add file name to each card for tagging
						for (const card of cards) {
							allCards.push({
								q: card.q,
								a: card.a,
								fileName: file.name,
							});
						}
						totalCards += cards.length;
					}
				} catch (error) {
					console.error(
						`Failed to process file ${file.path}:`,
						error
					);
				}
			}

			if (allCards.length === 0) {
				new Notice("No cards found in any files");
				return;
			}

			new Notice(`Adding ${allCards.length} cards to Anki...`);

			console.log(allCards);

			// Now batch add all cards to Anki
			const notes = allCards.map((card) => ({
				deckName: deckName,
				modelName: "Basic",
				fields: {
					Front: card.q,
					Back: card.a,
				},
				tags: ["obsidian-export", card.fileName],
			}));

			try {
				await this.addCards(notes);

				new Notice(
					`Successfully synced ${totalCards} Anki cards to deck "${deckName}"`
				);
			} catch (error) {
				console.error("Failed to batch add cards to Anki:", error);
				new Notice(`Failed to add cards to Anki: ${error}`);
			}
		} catch (error) {
			new Notice(`Failed to sync Anki cards: ${error}`);
			console.error("Anki sync failed:", error);
		}
	}

	private getAllMarkdownFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];

		const processFolder = (currentFolder: TFolder) => {
			for (const child of currentFolder.children) {
				if (child instanceof TFile && child.extension === "md") {
					files.push(child);
				} else if (child instanceof TFolder) {
					processFolder(child);
				}
			}
		};

		processFolder(folder);
		return files;
	}

	async onload() {
		await this.loadSettings();

		// Add context menu item for folders
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item.setTitle("Sync Anki cards of this folder")
							.setIcon("sync")
							.onClick(() => {
								const modal = new AnkiSyncModal(
									this.app,
									file.name,
									(deckName: string) => {
										this.syncFolderToAnki(file, deckName);
									}
								);
								modal.open();
							});
					});
				}
			})
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
