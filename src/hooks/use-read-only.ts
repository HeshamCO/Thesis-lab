import { useEffect, useState } from "react";

/**
 * Returns true when the app is NOT running on localhost.
 * Used to disable write actions (start run, create sweep, etc.) in the
 * public read-only deployment without touching server-side auth.
 *
 * Starts as true (disabled) to avoid a flash of enabled buttons during SSR.
 * Flips to false on the client if the hostname is localhost / 127.0.0.1.
 */
export function useReadOnly(): boolean {
	const [readOnly, setReadOnly] = useState(true);
	useEffect(() => {
		const h = window.location.hostname;
		setReadOnly(h !== "localhost" && h !== "127.0.0.1" && h !== "::1");
	}, []);
	return readOnly;
}
