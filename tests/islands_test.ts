import {
  assert,
  assertEquals,
  assertStringIncludes,
  delay,
  Page,
} from "./deps.ts";
import {
  assertNotSelector,
  assertSelector,
  assertTextMatch,
  clickWhenListenerReady,
  waitForText,
  withFakeServe,
  withPageName,
} from "./test_utils.ts";

Deno.test({
  name: "island tests",
  async fn(t) {
    await withPage(async (page, address) => {
      async function counterTest(counterId: string, originalValue: number) {
        const pElem = await page.waitForSelector(`#${counterId} > p`);

        const value = await pElem?.evaluate((el) => el.textContent);
        assert(value === `${originalValue}`, `${counterId} first value`);

        await clickWhenListenerReady(page, `#b-${counterId}`);
        await waitForText(page, `#${counterId} > p`, String(originalValue + 1));
      }

      await page.goto(`${address}/islands`, {
        waitUntil: "networkidle2",
      });

      await t.step("Ensure 5 islands on 1 page are revived", async () => {
        await counterTest("counter1", 3);
        await counterTest("counter2", 10);
        await counterTest("folder-counter", 3);
        await counterTest("subfolder-counter", 3);
        await counterTest("kebab-case-file-counter", 5);
      });

      await t.step("Ensure an island revive an img 'hash' path", async () => {
        // Ensure src path has __frsh_c=
        const pElem = await page.waitForSelector(`#img-in-island`);
        const srcString = (await pElem?.getProperty("src"))?.toString()!;
        assertStringIncludes(srcString, "image.png?__frsh_c=");

        // Ensure src path is the same as server rendered
        const resp = await fetch(new Request(`${address}/islands`));
        const body = await resp.text();

        const imgFilePath = body.match(/img id="img-in-island" src="(.*?)"/)
          ?.[1]!;
        assertStringIncludes(srcString, imgFilePath);
      });
    });
  },
});

Deno.test({
  name: "multiple islands exported from one file",
  async fn(t) {
    await withPage(async (page, address) => {
      async function counterTest(counterId: string, originalValue: number) {
        const pElem = await page.waitForSelector(`#${counterId} > p`);

        const value = await pElem?.evaluate((el) => el.textContent);
        assert(value === `${originalValue}`, `${counterId} first value`);

        await clickWhenListenerReady(page, `#b-${counterId}`);
        await waitForText(page, `#${counterId} > p`, String(originalValue + 1));
      }

      await page.goto(`${address}/islands/multiple_island_exports`, {
        waitUntil: "networkidle2",
      });

      await t.step("Ensure 3 islands on 1 page are revived", async () => {
        await counterTest("counter0", 4);
        await counterTest("counter1", 3);
        await counterTest("counter2", 10);
      });
    });
  },
});

function withPage(fn: (page: Page, address: string) => Promise<void>) {
  return withPageName("./tests/fixture/main.ts", fn);
}

Deno.test({
  name: "island tests with </script>",

  async fn(t) {
    await withPage(async (page, address) => {
      page.on("dialog", () => {
        assert(false, "There is XSS");
      });

      await page.goto(`${address}/evil`, {
        waitUntil: "networkidle2",
      });

      await t.step("prevent XSS on Island", async () => {
        const bodyElem = await page.waitForSelector(`body`);
        const value = await bodyElem?.evaluate((el) => el.getInnerHTML());

        assertStringIncludes(
          value,
          `{"message":"\\u003c/script\\u003e\\u003cscript\\u003ealert('test')\\u003c/script\\u003e"}`,
          `XSS is not escaped`,
        );
      });
    });
  },
});

Deno.test({
  name: "island with fragment as root",

  async fn(_t) {
    await withPage(async (page, address) => {
      await page.goto(`${address}/islands/root_fragment`, {
        waitUntil: "networkidle2",
      });

      const clickableSelector = "#root-fragment-click-me";

      await page.waitForSelector(clickableSelector);

      await waitForText(page, `#island-parent`, "HelloWorld");

      await clickWhenListenerReady(page, clickableSelector);
      await waitForText(page, `#island-parent`, "HelloWorldI'm rendered now");
    });
  },
});

Deno.test({
  name: "island with fragment as root and conditional child first",

  async fn(_t) {
    await withPage(async (page, address) => {
      await page.goto(
        `${address}/islands/root_fragment_conditional_first`,
        {
          waitUntil: "networkidle2",
        },
      );

      const clickableSelector = "#root-fragment-conditional-first-click-me";
      await page.waitForSelector(clickableSelector);

      await waitForText(page, "#island-parent", "HelloWorld");

      await clickWhenListenerReady(page, clickableSelector);
      await waitForText(
        page,
        "#island-parent",
        "I'm rendered on topHelloWorld",
      );
    });
  },
});

Deno.test({
  name: "island that returns `null`",

  async fn(_t) {
    await withPage(async (page, address) => {
      await page.goto(`${address}/islands/returning_null`, {
        waitUntil: "networkidle2",
      });

      await page.waitForSelector(".added-by-use-effect");
    });
  },
});

Deno.test({
  name: "island using `npm:` specifiers",

  async fn(_t) {
    await withPageName("./tests/fixture_npm/main.ts", async (page, address) => {
      await page.setJavaScriptEnabled(false);
      await page.goto(address, { waitUntil: "networkidle2" });
      assert(await page.waitForSelector("#server-true"));

      await page.setJavaScriptEnabled(true);
      await page.reload({ waitUntil: "networkidle2" });
      assert(await page.waitForSelector("#browser-true"));
    });
  },
});

Deno.test({
  name: "works with older preact-render-to-string v5",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_preact_rts_v5/main.ts",
      async (page, address) => {
        await page.goto(address, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector("#foo");
        await waitForText(page, "#foo", "it works");
      },
    );
  },
});

Deno.test({
  name: "pass single JSX child to island",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_jsx_child`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");
        await waitForText(page, ".island", "it works");
      },
    );
  },
});

Deno.test({
  name: "pass multiple JSX children to island",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_jsx_children`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");

        await delay(100);
        const text = await page.$eval(".island", (el) => el.textContent);
        assertEquals(text, "it works");
      },
    );
  },
});

Deno.test({
  name: "pass multiple text JSX children to island",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_jsx_text`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");

        await delay(100);
        const text = await page.$eval(".island", (el) => el.textContent);
        assertEquals(text, "it works");
      },
    );
  },
});

Deno.test({
  name: "render island in island",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_in_island`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");
        await waitForText(page, ".island .island p", "it works");
      },
    );
  },
});

Deno.test({
  name: "render island inside island definition",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_in_island_definition`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");

        await waitForText(page, ".island .island p", "it works");

        // Check that there is no duplicated content which could happen
        // when islands aren't initialized correctly
        await waitForText(page, "#page", "it works");
      },
    );
  },
});

Deno.test({
  name:
    "render island with JSX children that render another island with JSX children",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_jsx_island_jsx`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");

        await waitForText(
          page,
          ".island .server .island .server p",
          "it works",
        );
      },
    );
  },
});

Deno.test({
  name: "render sibling islands",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_siblings`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");

        await waitForText(page, ".island .a", "it works");
        await waitForText(page, ".island + .island .b", "it works");
      },
    );
  },
});

Deno.test({
  name: "render sibling islands that render nothing initially",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_conditional`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector("button");

        await delay(100);
        await page.click("button");

        // Button text is matched too, but this allows us
        // to assert correct ordering. The "island content" should
        // be left of "Toggle"
        await waitForText(page, "#page", "island contentToggle");
      },
    );
  },
});

Deno.test({
  name: "serialize inner island props",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_nested_props`, {
          waitUntil: "networkidle2",
        });
        await page.waitForSelector(".island");

        await waitForText(page, ".island .island p", "it works");
      },
    );
  },
});

Deno.test({
  name: "render island inside island when passed as fn child",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_fn_child`);
        await page.waitForSelector(".island");
        await waitForText(page, "#page", "it works");
      },
    );
  },
});

Deno.test({
  name: "render nested islands in correct order",

  async fn(_t) {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_order`);
        await page.waitForSelector(".island");
        await waitForText(page, "#page", "leftcenterright");
      },
    );
  },
});

Deno.test({
  name: "render nested islands with server children conditionally",

  async fn() {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_conditional_lazy`);
        await waitForText(page, ".island p", "island content");

        await page.click("button");
        await waitForText(page, ".island p", "server rendered");
      },
    );
  },
});

Deno.test({
  name: "revive island in lazy server rendered children conditionally",

  async fn() {
    await withPageName(
      "./tests/fixture_island_nesting/main.ts",
      async (page, address) => {
        await page.goto(`${address}/island_conditional_lazy_island`);
        await waitForText(page, ".island p", "island content");

        await page.click("button");
        await waitForText(page, ".island .server", "server rendered");

        await page.click("button.counter");
        await waitForText(page, ".island .count", "1");
      },
    );
  },
});

Deno.test({
  name: "revive boolean attributes",

  async fn() {
    await withPageName(
      "./tests/fixture/main.ts",
      async (page, address) => {
        await page.goto(`${address}/preact/boolean_attrs`);
        await waitForText(page, ".form-revived", "Revived: true");

        const checked = await page.$eval(
          "input[type=checkbox]",
          (el) => el.checked,
        );
        assertEquals(checked, true, "Checkbox is not checked");

        const required = await page.$eval(
          "input[type=text]",
          (el) => el.required,
        );
        assertEquals(required, true, "Text input is not marked as required");

        const radioChecked = await page.$eval(
          "input[type=radio][value='2']",
          (el) => el.checked,
        );
        assertEquals(
          radioChecked,
          true,
          "Text input is not marked as required",
        );

        const selected = await page.$eval(
          "select",
          (el) => el.options[el.selectedIndex].text,
        );
        assertEquals(selected, "bar", "'bar' value is not selected");
      },
    );
  },
});

Deno.test("throws when passing non-jsx children to an island", async (t) => {
  await withFakeServe(
    "./tests/fixture_island_nesting/dev.ts",
    async (server) => {
      const doc = await server.getHtml(`/island_invalid_children`);

      assertSelector(doc, ".frsh-error-page");
      assertTextMatch(doc, "pre", /Invalid JSX child passed to island/);

      const doc2 = await server.getHtml(`/island_invalid_children_fn`);

      assertSelector(doc2, ".frsh-error-page");
      assertTextMatch(doc2, "pre", /Invalid JSX child passed to island/);

      await t.step("should not throw on valid children", async () => {
        const doc2 = await server.getHtml(`/island_valid_children`);

        assertNotSelector(doc2, ".frsh-error-page");
      });
    },
  );
});
