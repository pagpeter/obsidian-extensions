import * as fs from "node:fs";
import * as crypto from "node:crypto";

const getMimeType = (filename: string): string => {
	const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
	switch (ext) {
		case ".pdf":
			return "application/pdf";
		case ".md":
			return "text/markdown";
		default:
			return "text/plain";
	}
};

const getFileHash = (filePath: string): string => {
	const fileBuffer = fs.readFileSync(filePath);
	return crypto
		.createHash("sha256")
		.update(fileBuffer)
		.digest("hex")
		.substring(0, 8);
};

export { getFileHash, getMimeType };
