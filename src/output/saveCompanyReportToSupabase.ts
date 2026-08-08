import type { CompanyReport } from "../types/companyReport.schema.js";

type SupabaseError = {
  message: string;
};

type SupabaseResult<T> = Promise<{
  data: T | null;
  error: SupabaseError | null;
}>;

type SavedReportRow = {
  id: string;
  report_id: string | null;
  slug: string | null;
};

type SerpReportsTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      limit: (count: number) => SupabaseResult<SavedReportRow[]>;
    };
  };
  insert: (payload: SerpReportPayload) => {
    select: (columns: string) => {
      single: () => SupabaseResult<SavedReportRow>;
    };
  };
  update: (payload: SerpReportPayload) => {
    eq: (column: string, value: string) => {
      select: (columns: string) => {
        single: () => SupabaseResult<SavedReportRow>;
      };
    };
  };
};

export type CompanyReportSupabaseClient = {
  from: (table: "serp_reports") => SerpReportsTable;
};

export type SavedReportReference = {
  id: string;
  report_id: string | null;
  slug: string | null;
};

type SerpReportPayload = {
  report_id: string;
  slug: string;
  website_url: string;
  company_name: string;
  status: CompanyReport["status"];
  artifact: CompanyReport;
  updated_at: string;
};

type SaveCompanyReportToSupabaseDependencies = {
  client?: CompanyReportSupabaseClient;
  now?: () => Date;
};

const savedReportColumns = "id, report_id, slug";

export async function saveCompanyReportToSupabase(
  companyReport: CompanyReport,
  dependencies: SaveCompanyReportToSupabaseDependencies = {},
): Promise<SavedReportReference> {
  const client = dependencies.client ?? (await createServerSupabaseClient());
  const payload = buildSerpReportPayload(
    companyReport,
    dependencies.now?.() ?? new Date(),
  );

  const matchingRowsResult = await client
    .from("serp_reports")
    .select(savedReportColumns)
    .eq("slug", companyReport.report_slug)
    .limit(2);

  throwIfSupabaseError(matchingRowsResult.error, "select serp_reports");

  const matchingRows = matchingRowsResult.data ?? [];

  if (matchingRows.length > 1) {
    throw new Error(
      `Found multiple serp_reports rows for slug "${companyReport.report_slug}". Refusing to update an arbitrary row.`,
    );
  }

  if (matchingRows.length === 1) {
    const savedRow = await updateExistingReport(
      client,
      matchingRows[0].id,
      payload,
    );

    return savedRow;
  }

  return insertNewReport(client, payload);
}

export function buildSerpReportPayload(
  companyReport: CompanyReport,
  updatedAt: Date,
): SerpReportPayload {
  return {
    report_id: companyReport.report_id,
    slug: companyReport.report_slug,
    website_url: companyReport.website_url,
    company_name: companyReport.company.name,
    status: companyReport.status,
    artifact: companyReport,
    updated_at: updatedAt.toISOString(),
  };
}

async function insertNewReport(
  client: CompanyReportSupabaseClient,
  payload: SerpReportPayload,
): Promise<SavedReportReference> {
  const insertResult = await client
    .from("serp_reports")
    .insert(payload)
    .select(savedReportColumns)
    .single();

  throwIfSupabaseError(insertResult.error, "insert serp_reports");

  if (insertResult.data === null) {
    throw new Error("Supabase insert serp_reports returned no saved row.");
  }

  return insertResult.data;
}

async function updateExistingReport(
  client: CompanyReportSupabaseClient,
  rowId: string,
  payload: SerpReportPayload,
): Promise<SavedReportReference> {
  const updateResult = await client
    .from("serp_reports")
    .update(payload)
    .eq("id", rowId)
    .select(savedReportColumns)
    .single();

  throwIfSupabaseError(updateResult.error, "update serp_reports");

  if (updateResult.data === null) {
    throw new Error("Supabase update serp_reports returned no saved row.");
  }

  return updateResult.data;
}

function throwIfSupabaseError(error: SupabaseError | null, action: string): void {
  if (error !== null) {
    throw new Error(`Supabase ${action} failed: ${error.message}`);
  }
}

async function createServerSupabaseClient(): Promise<CompanyReportSupabaseClient> {
  const [{ createClient }, { getRequiredEnvVar }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("../config/env.js"),
  ]);

  return createClient(
    getRequiredEnvVar("SUPABASE_URL"),
    getRequiredEnvVar("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  ) as unknown as CompanyReportSupabaseClient;
}
