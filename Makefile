publish: dist/scrape2md.ts
	deno publish

dist/scrape2md.ts:
	curl -X 'GET' \
  'https://api.val.town/v1/vals/1ff86f92-e9f7-11ee-9325-8aad37b30b4b' \
  -H 'accept: application/json' | jq .code -r > $@

clean:
	rm dist/*.ts