DOWNLOADS=markdown_download.ts README.md jsr.json
GET_VAL_CMD=curl -X 'GET' \
  'https://api.val.town/v1/vals/1ff86f92-e9f7-11ee-9325-8aad37b30b4b' \
  -H 'accept: application/json' | jq -r

publish: $(DOWNLOADS)
	deno publish

markdown_download.ts:
	$(GET_VAL_CMD) .code  > $@

README.md:
	$(GET_VAL_CMD) .readme > $@

jsr.json: template/jsr.json markdown_download.ts
	jq --arg version "1.0.$(shell $(GET_VAL_CMD) .version)" '.version = $$version' template/jsr.json > jsr.json

clean:
	rm -f $(DOWNLOADS)