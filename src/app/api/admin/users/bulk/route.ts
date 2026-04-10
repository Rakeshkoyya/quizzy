import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const ADMIN_PASSWORD = "Rocky99";

function verifyAdmin(request: Request) {
  const authHeader = request.headers.get("x-admin-password");
  return authHeader === ADMIN_PASSWORD;
}

interface CsvRow {
  username: string;
  password: string;
  name: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return []; // need header + at least 1 row

  // Parse header to find column indices
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  const usernameIdx = header.findIndex((h) => h === "username");
  const passwordIdx = header.findIndex((h) => h === "password");
  const nameIdx = header.findIndex((h) => h === "name" || h === "display name" || h === "displayname");

  if (usernameIdx === -1 || passwordIdx === -1) {
    throw new Error("CSV must have 'username' and 'password' columns in the header row");
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const username = (cols[usernameIdx] || "").trim();
    const password = (cols[passwordIdx] || "").trim();
    const name = nameIdx !== -1 ? (cols[nameIdx] || "").trim() : "";

    if (!username || !password) continue; // skip empty rows

    rows.push({ username, password, name });
  }

  return rows;
}

/** Parse a single CSV line, handling quoted fields */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    let rows: CsvRow[];

    try {
      rows = parseCsv(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse CSV";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in the file. Make sure it has username and password columns." }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: "Maximum 500 users per upload" }, { status: 400 });
    }

    // Validate all rows first
    const errors: string[] = [];
    const seenUsernames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because 1-indexed + header row

      if (row.username.length < 3 || row.username.length > 50) {
        errors.push(`Row ${rowNum}: Username "${row.username}" must be 3-50 characters`);
      } else if (!USERNAME_REGEX.test(row.username)) {
        errors.push(`Row ${rowNum}: Username "${row.username}" can only contain letters, numbers, and underscores`);
      }

      if (row.password.length < 4) {
        errors.push(`Row ${rowNum}: Password must be at least 4 characters`);
      }

      const lowerUsername = row.username.toLowerCase();
      if (seenUsernames.has(lowerUsername)) {
        errors.push(`Row ${rowNum}: Duplicate username "${row.username}" in file`);
      }
      seenUsernames.add(lowerUsername);

      if (errors.length >= 20) {
        errors.push("... and more errors. Fix the above first.");
        break;
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation errors", details: errors }, { status: 400 });
    }

    // Check for existing usernames in database
    const usernames = rows.map((r) => r.username);
    const existingUsers = await prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { username: true },
    });
    const existingSet = new Set(existingUsers.map((u) => u.username));

    if (existingSet.size > 0) {
      const dupes = Array.from(existingSet).slice(0, 10);
      return NextResponse.json({
        error: `These usernames already exist: ${dupes.join(", ")}${existingSet.size > 10 ? ` and ${existingSet.size - 10} more` : ""}`,
      }, { status: 409 });
    }

    // Hash all passwords
    const hashedRows = await Promise.all(
      rows.map(async (row) => ({
        username: row.username,
        password: await bcrypt.hash(row.password, 12),
        name: row.name || row.username,
        email: null,
      })),
    );

    // Bulk create
    const result = await prisma.user.createMany({
      data: hashedRows,
    });

    return NextResponse.json({
      created: result.count,
      message: `Successfully created ${result.count} user${result.count > 1 ? "s" : ""}`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bulk create users";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
