import { GoogleGenAI, Caches, Models, Chat } from "@google/genai";
import * as utils from "./utils";

const SYSTEM_PROMPT = `You are a copilot in a markdown reader. 
You are able to output LaTeX, mermaid.js diagrams and Markdown. Give short, concise answers. 
When using Markdown lists, always start them with a "-" instead of with an "*".
Use markdown lists and callouts extensively.
Always answer in german.`;

interface UploadedFileInfo {
	file: any;
	hash: string;
}

class WrappedChat {
	private ai: GoogleGenAI;
	private modelName: string;
	private files: any[];
	private uploadedFiles: Map<string, UploadedFileInfo>;
	private cache: any;
	private chat: Chat | null;

	constructor(apiKey: string, model: string) {
		this.ai = new GoogleGenAI({ apiKey, vertexai: false });
		this.modelName = model;
		this.files = [];
		this.uploadedFiles = new Map();
		this.cache = null;
		this.chat = null;
	}

	async loadUploadedFiles(): Promise<void> {
		try {
			const listResponse = await this.ai.files.list({
				config: { pageSize: 50 },
			});

			for await (const file of listResponse) {
				const displayName = file.displayName || file.name || "";
				const lastColonIndex = displayName.lastIndexOf(":");

				if (lastColonIndex !== -1) {
					const filePath = displayName.substring(0, lastColonIndex);
					const hash = displayName.substring(lastColonIndex + 1);
					console.log(filePath, "-", hash);

					this.uploadedFiles.set(filePath, {
						file: file,
						hash: hash,
					});
				}
			}

			console.log(
				`[+] Loaded ${this.uploadedFiles.size} previously uploaded files`
			);
		} catch (error) {
			console.error("[!] Failed to load uploaded files:", error);
		}
	}

	async uploadFile(filePath: string): Promise<any> {
		const mimeType = utils.getMimeType(filePath);
		const currentHash = utils.getFileHash(filePath);

		if (this.uploadedFiles.has(filePath)) {
			const existing = this.uploadedFiles.get(filePath)!;

			if (existing.hash === currentHash) {
				console.log(
					`[+] File ${filePath} already uploaded with same hash, reusing existing file`
				);
				existing.file.displayName = filePath;
				this.files.push(existing.file);
				return existing.file;
			} else {
				console.log(
					`[+] File ${filePath} exists but hash differs, deleting old version`
				);
				try {
					await this.ai.files.delete({ name: existing.file.name });
					this.uploadedFiles.delete(filePath);
				} catch (error) {
					console.error("[!] Failed to delete old file:", error);
				}
			}
		}

		try {
			const displayName = `${filePath}:${currentHash}`;

			const uploaded = await this.ai.files.upload({
				file: filePath,
				config: { mimeType, displayName },
			});

			console.log("[+] File uploaded successfully!", uploaded.name);
			uploaded.displayName = filePath;

			this.uploadedFiles.set(filePath, {
				file: uploaded,
				hash: currentHash,
			});

			this.files.push(uploaded);
			return uploaded;
		} catch (error) {
			console.error("[!] Failed to upload file:", error);
			throw error;
		}
	}

	async createNewCache(): Promise<any> {
		if (this.files.length === 0) {
			throw new Error(
				"No files uploaded. Upload files before creating cache."
			);
		}

		//@ts-ignore
		const { apiClient } = this.ai;
		const caches = new Caches(apiClient);

		try {
			this.cache = await caches.create({
				model: this.modelName,
				config: {
					systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
					contents: {
						parts: this.files.map((f) => ({
							fileData: {
								fileUri: f.uri,
								mimeType: f.mimeType,
							},
						})),
						role: "user",
					},
				},
			});

			console.log("[+] Cache created successfully!", this.cache.name);
			return this.cache;
		} catch (error) {
			console.error("[!] Failed to create cache:", error);
			throw error;
		}
	}

	async loadCache(cacheId: string): Promise<any> {
		//@ts-ignore
		const { apiClient } = this.ai;
		const caches = new Caches(apiClient);

		try {
			this.cache = await caches.get({ name: cacheId });
			console.log("[+] Cache loaded successfully!", this.cache.name);
			return this.cache;
		} catch (error) {
			console.error("[!] Failed to load cache:", error);
			throw error;
		}
	}

	async preinit(): Promise<void> {
		await this.loadUploadedFiles();
	}

	async init(): Promise<void> {
		if (!this.cache) {
			throw new Error(
				"No cache available. Create or load a cache first."
			);
		}
		//@ts-ignore
		const { apiClient } = this.ai;
		const model = new Models(apiClient);

		this.chat = new Chat(apiClient, model, this.modelName, {
			systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
			cachedContent: this.cache,
		});

		console.log("[+] Chat initialized successfully!");
	}

	async askQuestion(question: string): Promise<string> {
		if (!this.chat) {
			throw new Error("Chat not initialized. Call init() first.");
		}

		try {
			const response = await this.chat.sendMessageStream({
				message: question,
				config: {
					cachedContent: this.cache.name,
				},
			});

			let fullResponse = "";
			for await (const chunk of response) fullResponse += chunk.text;

			return fullResponse;
		} catch (error) {
			console.error("Failed to get response:", error);
			throw error;
		}
	}
}
