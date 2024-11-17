
publish:
	deno publish

deploy: publish
	cd markdown-download-cf && pnpm dlx jsr add @tarasglek/markdown-download && pnpm run deploy
