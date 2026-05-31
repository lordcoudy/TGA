export const MAX_REPORT_BYTES = 32 * 1024 * 1024;
export const MAX_REPORT_SIZE_LABEL = "32 MB";

export function reportSizeBytes(report: unknown): number {
	return Buffer.byteLength(JSON.stringify(report), "utf8");
}

export function reportExceedsLimit(report: unknown): boolean {
	return reportSizeBytes(report) > MAX_REPORT_BYTES;
}
