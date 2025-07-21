/* eslint-disable @typescript-eslint/no-explicit-any */
import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import electon from "electron";
import { ExampleSettingTab } from "./settings";
const { net } = electon.remote;

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	sokratesToken: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	sokratesToken: "default",
};

const DEFAULT_HEADERS = {
	accept: "*/*",
	"accept-language": "de-DE,de;q=0.9,en;q=0.8,en-US;q=0.7",
	"content-type": "application/json",
	dnt: "1",
	origin: "https://ws1.app.sokrates.ae.org",
	priority: "u=1, i",
	referer:
		"https://ws1.app.sokrates.ae.org/?token=bfd73df7-c159-4c17-92fa-a7cb585d37d4&backlink=https%3A%2F%2Fapp.sokrates.ae.org%2Fcourse%2Fcb7aaca3-4e0b-4959-b00c-58e5061988fc",
	"sec-ch-ua":
		'"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
	"sec-ch-ua-mobile": "?0",
	"sec-ch-ua-platform": '"macOS"',
	"sec-fetch-dest": "empty",
	"sec-fetch-mode": "cors",
	"sec-fetch-site": "same-origin",
	"user-agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
};

const SOKRATES_ENDPOINT =
	"https://ws1.app.sokrates.ae.org/api/evaluateSubmission";

const request = async (
	url: string,
	method: string,
	headers: Record<string, string>,
	data: string,
	handlers: {
		onData: (chunk: any) => void;
		onEnd: () => void;
		onError: (err: any) => void;
		onResponse: (res: any) => void;
	}
): Promise<string> => {
	return new Promise((resolve, reject) => {
		const req = net.request({
			method,
			url,
		});

		for (const key in headers) {
			req.setHeader(key, headers[key]);
		}

		req.on("response", (res: any) => {
			handlers.onResponse(res);
			res.on("data", (chunk: any) => {
				handlers.onData(chunk);
			});
			res.on("end", () => {
				handlers.onEnd();
				resolve("");
			});
			res.on("error", (err: any) => {
				handlers.onError(err);
				reject(err);
			});
		});

		req.on("error", (err: any) => {
			handlers.onError(err);
			reject(err);
		});

		req.write(data);
		req.end();
	});
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	parseSSEEvents(
		responseData: string
	): { eventType: string; eventData: string }[] {
		const events = responseData.split("\n\n");
		return events
			.map((eventBlock) => {
				const lines = eventBlock.split("\n");
				let eventType = "";
				let eventData = "";
				for (const line of lines) {
					if (line.startsWith("event:")) {
						eventType = line.replace("event:", "").trim();
					} else if (line.startsWith("data:")) {
						eventData = line.replace("data:", "").trim();
					}
				}
				return eventType && eventData ? { eventType, eventData } : null;
			})
			.filter((e): e is { eventType: string; eventData: string } => !!e);
	}

	handleFeedbackEvent(editor: Editor, eventData: string) {
		try {
			const feedback = JSON.parse(eventData);
			const callout_prefix = feedback.is_valid
				? "> [!success]"
				: "> [!error]";

			let callout = `${callout_prefix} Sokrates Feedback\n ${feedback.summary}`;

			feedback.comments?.forEach((c: any) => {
				try {
					callout += `>\n>\n**${c.type}: ${c.title}**\n>  - ${
						c.text
					}${c.citation?.text ? `\n>  - ${c.citation.text}` : ""}`;
				} catch (e) {
					new Notice("Error parsing comment:" + e);
				}
			});

			const cursor = editor.getCursor("to");

			editor.replaceRange("\n\n" + callout + "\n", {
				line: cursor.line + 1,
				ch: 0,
			});

			// Add logs for feedback
			if (
				feedback.summary &&
				!feedback.summary.toLowerCase().includes("invalid")
			) {
				console.log(
					"[success] Good feedback received:",
					feedback.summary
				);
			} else if (
				feedback.summary &&
				feedback.summary.toLowerCase().includes("invalid")
			) {
				console.error(
					"[error] Invalid feedback received:",
					feedback.summary
				);
			} else {
				console.log("[info] Feedback received:", feedback.summary);
			}
		} catch (err) {
			console.error("Failed to parse feedbackEvent:", err);
		}
	}

	handleSokratesResponse(
		receivedAlready: string[],
		editor: Editor,
		responseData: string
	) {
		const events = this.parseSSEEvents(responseData);
		console.log(events);
		for (const { eventType, eventData } of events) {
			const id = JSON.stringify({ eventType, eventData });
			if (!receivedAlready.includes(id) && eventType == "progressEvent") {
				new Notice(`Sokrates: ${eventData}`);
			}
			receivedAlready.push(id);
			if (eventType === "feedbackEvent")
				this.handleFeedbackEvent(editor, eventData);
		}
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ExampleSettingTab(this.app, this));
		const token = this.settings.sokratesToken;
		if (!token) new Notice("Sokrates: no token set up");
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "ask-sokrates",
			name: "Ask Sokrates",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (!token) return new Notice("Sokrates: no token set up");
				console.log("Token:", token);
				const selection = editor.getSelection();
				console.log("Selection:", selection, electon.remote);
				new Notice("Asking sokrates...");
				let r;
				try {
					const requestBody = JSON.stringify({
						token: token,
						submission: selection,
					});

					const handlers = {
						onData: (chunk: any) => {
							responseData += chunk.toString();
							this.handleSokratesResponse(
								receivedAlready,
								editor,
								responseData
							);
						},
						onEnd: () => {
							console.log("Request completed");
						},
						onError: (err: any) => {
							console.error("Request error:", err);
						},
						onResponse: (res: any) => {
							console.log(
								"Response received with status code:",
								res.statusCode
							);
							if (res.statusCode === 401)
								new Notice(
									"Sokrates: failed to ask (Invalid Token)"
								);
						},
					};

					const receivedAlready: string[] = [];
					let responseData = "";

					r = await request(
						SOKRATES_ENDPOINT,
						"POST",
						DEFAULT_HEADERS,
						requestBody,
						handlers
					);

					console.log(r);
					new Notice("Result: " + r);
				} catch (e) {
					console.log(e, r);
					new Notice("Error calling sokrates: " + e);
				}

				editor.replaceSelection("Sample Editor Command");
			},
		});
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
