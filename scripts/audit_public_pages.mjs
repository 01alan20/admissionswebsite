import { chromium } from "playwright";

const base = process.env.AUDIT_BASE || "http://127.0.0.1:4173";

const results = [];

const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
};

const pathnameOf = (url) => {
  try {
    return new URL(url.toString()).pathname;
  } catch {
    return "";
  }
};

const expectPath = async (page, expectedPath, timeout = 5000) => {
  await page.waitForURL((url) => pathnameOf(url) === expectedPath, { timeout });
};

const safeWaitNetwork = async (page) => {
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
  } catch {
    // Some pages keep background requests open; DOM checks still validate UX.
  }
};

const goto = async (page, path) => {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  await safeWaitNetwork(page);
};

const isActivePill = async (locator) =>
  locator.evaluate((el) => String(el.className || "").includes("bg-brand-primary"));

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    // Route smoke checks.
    for (const path of [
      "/",
      "/explore",
      "/faq",
      "/timelines",
      "/contact",
      "/compare",
      "/high-school-pathways",
    ]) {
      try {
        await goto(desktop, path);
        const hasErrorBoundary =
          (await desktop.getByText("Something went wrong", { exact: false }).count()) > 0;
        record(`route:${path}`, !hasErrorBoundary, hasErrorBoundary ? "error boundary visible" : "ok");
      } catch (err) {
        record(`route:${path}`, false, String(err));
      }
    }

    // Desktop header nav behavior from Explore.
    for (const navCase of [
      { label: "Home", expected: "/" },
      { label: "FAQs", expected: "/faq" },
      { label: "Free Review", expected: "/contact" },
    ]) {
      try {
        await goto(desktop, "/explore");
        await desktop.getByRole("link", { name: navCase.label }).first().click();
        await expectPath(desktop, navCase.expected);
        record(`nav:explore->${navCase.expected}`, true, "ok");
      } catch (err) {
        record(`nav:explore->${navCase.expected}`, false, String(err));
      }
    }

    // Nav while search field changes (possible blur/click race).
    try {
      await goto(desktop, "/explore");
      await desktop.locator("#college-search").fill("cal");
      await desktop.getByRole("link", { name: "Home" }).first().click();
      await expectPath(desktop, "/");
      record("nav:explore(search-change)->home", true, "ok");
    } catch (err) {
      record("nav:explore(search-change)->home", false, String(err));
    }

    // Mobile menu nav behavior from Explore.
    try {
      await goto(mobile, "/explore");
      await mobile.getByRole("button", { name: "Toggle navigation" }).click();
      await mobile.getByRole("link", { name: "FAQs" }).first().click();
      await expectPath(mobile, "/faq");
      record("nav:mobile-explore->faq", true, "ok");
    } catch (err) {
      record("nav:mobile-explore->faq", false, String(err));
    }

    // Explore filters.
    try {
      await goto(desktop, "/explore");

      const openDetailsIfNeeded = async (summaryText, visibleLocator) => {
        const visible = await visibleLocator.isVisible().catch(() => false);
        if (!visible) {
          await desktop.locator("summary", { hasText: summaryText }).first().click();
        }
      };

      await openDetailsIfNeeded(
        "Tuition Budget",
        desktop.getByRole("button", { name: "Under $15k" }).first()
      );
      const budgetPill = desktop.getByRole("button", { name: "Under $15k" }).first();
      await budgetPill.click();
      record("filter:tuition-pill", await isActivePill(budgetPill), "toggled");

      await openDetailsIfNeeded(
        "Selectivity",
        desktop.getByRole("button", { name: "25-49%" }).first()
      );
      const selectivityPill = desktop.getByRole("button", { name: "25-49%" }).first();
      await selectivityPill.click();
      record("filter:selectivity-pill", await isActivePill(selectivityPill), "toggled");

      await openDetailsIfNeeded(
        "Testing expectations",
        desktop.getByRole("button", { name: "Optional" }).first()
      );
      const optionalPill = desktop.getByRole("button", { name: "Optional" }).first();
      await optionalPill.click();
      const satPill = desktop.getByRole("button", { name: "SAT" }).first();
      await satPill.click();
      await desktop.locator("#score-min").fill("1400");
      record(
        "filter:testing-pill+score",
        (await isActivePill(optionalPill)) && (await isActivePill(satPill)),
        "optional + sat floor set"
      );

      await openDetailsIfNeeded(
        "State",
        desktop.locator("details").filter({ has: desktop.locator("summary", { hasText: "State" }) }).locator("button").first()
      );
      const stateButtons = desktop
        .locator("details")
        .filter({ has: desktop.locator("summary", { hasText: "State" }) })
        .locator("button");
      if ((await stateButtons.count()) > 0) {
        const firstState = stateButtons.first();
        await firstState.click();
        record("filter:state-pill", await isActivePill(firstState), "toggled");
      } else {
        record("filter:state-pill", false, "no state options rendered");
      }

      await openDetailsIfNeeded("Majors", desktop.locator("#major-area-search"));
      const areaButtons = desktop.locator("#major-area-search").locator("xpath=following-sibling::div[1]//button");
      const specificButtons = desktop
        .locator("#specific-major-search")
        .locator("xpath=following-sibling::div[1]//button");

      let selectedAreaLabel = "";
      if ((await areaButtons.count()) > 0) {
        const firstArea = areaButtons.first();
        selectedAreaLabel = (await firstArea.innerText()).trim();
        await firstArea.click();
        record("filter:major-area-pill", await isActivePill(firstArea), selectedAreaLabel || "selected");
      } else {
        record("filter:major-area-pill", false, "no major area options rendered");
      }

      let selectedSpecificLabel = "";
      if ((await specificButtons.count()) > 0) {
        const firstSpecific = specificButtons.first();
        selectedSpecificLabel = (await firstSpecific.innerText()).trim();
        await firstSpecific.click();
        record(
          "filter:specific-major-pill",
          await isActivePill(firstSpecific),
          selectedSpecificLabel || "selected"
        );
      } else {
        record("filter:specific-major-pill", false, "no specific major options rendered");
      }

      await desktop.getByRole("button", { name: "Apply filters" }).click();
      const showingText = (await desktop.locator("text=Showing").first().textContent()) || "";
      record("filter:apply", showingText.includes("Showing"), showingText.trim() || "missing summary");

      await desktop.getByRole("button", { name: "Reset filters" }).click();
      await openDetailsIfNeeded(
        "Tuition Budget",
        desktop.getByRole("button", { name: "Under $15k" }).first()
      );
      const budgetActiveAfterReset = await isActivePill(
        desktop.getByRole("button", { name: "Under $15k" }).first()
      );
      let majorResetOk = true;
      if (selectedAreaLabel) {
        const areaByLabel = desktop.getByRole("button", { name: selectedAreaLabel }).first();
        if (await areaByLabel.count()) {
          majorResetOk = majorResetOk && !(await isActivePill(areaByLabel));
        }
      }
      if (selectedSpecificLabel) {
        const specificByLabel = desktop.getByRole("button", { name: selectedSpecificLabel }).first();
        if (await specificByLabel.count()) {
          majorResetOk = majorResetOk && !(await isActivePill(specificByLabel));
        }
      }
      record("filter:reset", !budgetActiveAfterReset && majorResetOk, "pill selections cleared");

      const nextButton = desktop.getByRole("button", { name: "Next" }).first();
      if (await nextButton.count()) {
        const wasDisabled = await nextButton.isDisabled();
        if (!wasDisabled) {
          const before = (await desktop.locator("text=/Page\\s+\\d+\\s+of\\s+\\d+/").first().textContent()) || "";
          await nextButton.click();
          const after = (await desktop.locator("text=/Page\\s+\\d+\\s+of\\s+\\d+/").first().textContent()) || "";
          record("filter:pagination-next", before !== after, `${before.trim()} -> ${after.trim()}`);
        } else {
          record("filter:pagination-next", true, "single-page result set");
        }
      } else {
        record("filter:pagination-next", true, "pagination not shown");
      }
    } catch (err) {
      record("filter-suite:explore", false, String(err));
    }

    // Explore result links.
    try {
      await goto(desktop, "/explore");
      await desktop.getByRole("link", { name: "View Details" }).first().click();
      await desktop.waitForURL("**/institution/*", { timeout: 7000 });
      record("explore:view-details-link", true, "navigated");
    } catch (err) {
      record("explore:view-details-link", false, String(err));
    }

    // Compare page interaction.
    try {
      await goto(desktop, "/compare");
      const input = desktop.getByPlaceholder("Add a university to compare...");
      await input.fill("University");
      const firstResult = desktop.locator("ul li").first();
      await firstResult.waitFor({ timeout: 7000 });
      const firstName = ((await firstResult.textContent()) || "").trim();
      await firstResult.click();
      const removeButtons = desktop.locator("button", { hasText: "×" });
      await removeButtons.first().waitFor({ timeout: 7000 });
      record("compare:add-school", (await removeButtons.count()) > 0, firstName || "selected first result");
    } catch (err) {
      record("compare:add-school", false, String(err));
    }

    // FAQ CTA link.
    try {
      await goto(desktop, "/faq");
      await desktop.getByRole("link", { name: "Explore US universities" }).click();
      await expectPath(desktop, "/explore");
      record("faq:explore-link", true, "ok");
    } catch (err) {
      record("faq:explore-link", false, String(err));
    }
  } finally {
    await desktop.close();
    await mobile.close();
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

await run();
