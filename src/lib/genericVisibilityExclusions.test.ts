import assert from "node:assert/strict";
import test from "node:test";

import {
  isGenericVisibilityExcluded,
  loadGenericVisibilityExclusions,
  normalizeCandidateHostname,
  parseGenericVisibilityExclusions,
} from "./genericVisibilityExclusions.js";

test("checked-in generic visibility registry loads and applies both matching modes", async () => {
  const exclusions = await loadGenericVisibilityExclusions();

  assert.ok(exclusions.registrableDomains.size > 0);
  assert.ok(exclusions.exactHosts.size > 0);
  assert.equal(isGenericVisibilityExcluded("youtube.com", exclusions), true);
  assert.equal(isGenericVisibilityExcluded("reddit.com", exclusions), true);
  assert.equal(
    isGenericVisibilityExcluded("subdomain.reddit.com", exclusions),
    true,
  );
  assert.equal(isGenericVisibilityExcluded("notg2.com", exclusions), false);
  assert.equal(isGenericVisibilityExcluded("play.google.com", exclusions), true);
  assert.equal(
    isGenericVisibilityExcluded("support.google.com", exclusions),
    false,
  );
});

test("candidate hostname normalization handles casing URLs ports paths and trailing dots", () => {
  assert.equal(normalizeCandidateHostname("WWW.YouTube.com"), "youtube.com");
  assert.equal(
    normalizeCandidateHostname("https://www.reddit.com/r/seo?sort=top#results"),
    "reddit.com",
  );
  assert.equal(
    normalizeCandidateHostname("HTTPS://WWW.Example.COM.:443/path"),
    "example.com",
  );
  assert.equal(
    normalizeCandidateHostname("www.example.com:8443/path"),
    "example.com",
  );
  assert.equal(normalizeCandidateHostname("not a hostname"), null);
  assert.equal(normalizeCandidateHostname(undefined), null);
});

test("allowlist domain boundaries override both exclusion modes", () => {
  const exclusions = parseGenericVisibilityExclusions({
    exclusions: {
      registrable_domains: {
        reviews: ["g2.com"],
      },
      exact_hosts: {
        stores: ["play.google.com"],
      },
    },
    allowlist: ["reviews.g2.com", "play.google.com"],
  });

  assert.equal(isGenericVisibilityExcluded("g2.com", exclusions), true);
  assert.equal(
    isGenericVisibilityExcluded("reviews.g2.com", exclusions),
    false,
  );
  assert.equal(
    isGenericVisibilityExcluded("nested.reviews.g2.com", exclusions),
    false,
  );
  assert.equal(
    isGenericVisibilityExcluded("play.google.com", exclusions),
    false,
  );
  assert.equal(isGenericVisibilityExcluded("notg2.com", exclusions), false);
});

test("registry validation rejects malformed category arrays and duplicate active entries", () => {
  assert.throws(
    () =>
      parseGenericVisibilityExclusions({
        exclusions: {
          registrable_domains: { reviews: "g2.com" },
          exact_hosts: { stores: [] },
        },
        allowlist: [],
      }),
    /Expected exclusions\.registrable_domains\.reviews to be an array/,
  );

  assert.throws(
    () =>
      parseGenericVisibilityExclusions({
        exclusions: {
          registrable_domains: {
            reviews: ["g2.com"],
            duplicated: ["WWW.G2.COM"],
          },
          exact_hosts: { stores: [] },
        },
        allowlist: [],
      }),
    /duplicate active entry g2\.com/,
  );
});
