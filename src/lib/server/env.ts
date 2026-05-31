import "server-only";

export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing ${name} env var.`);
	return value;
}

export function optionalEnv(name: string, fallback: string): string {
	return process.env[name] || fallback;
}
