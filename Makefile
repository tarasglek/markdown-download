publish: dist/scrape2md.ts
	deno publish

dist/scrape2md.ts:
	curl -X 'GET' \
  'https://api.val.town/v1/vals/4444c3fa-cd73-11ee-bfb1-8aad37b30b4b' \
  -H 'accept: application/json' | jq .code -r > $@

clean:
	rm dist/*.ts