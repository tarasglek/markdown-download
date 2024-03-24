publish: dist/markdown_download.ts
	deno publish

dist/markdown_download.ts:
	curl -X 'GET' \
  'https://api.val.town/v1/vals/1ff86f92-e9f7-11ee-9325-8aad37b30b4b' \
  -H 'accept: application/json' | jq .code -r > $@

clean:
	rm -f dist/*.ts