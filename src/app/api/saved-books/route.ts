import { NextResponse } from "next/server";
import { createDocument, listDocuments } from "@/lib/couchdb";

type Book = {
  key: string;
  title: string;
  author: string;
  coverImage: string | null;
  year?: number;
  subjects?: string[];
};

type SavedBook = Book & {
  savedAt: string;
};

export async function GET() {
  try {
    const docs = await listDocuments<SavedBook>();
    const items = docs.map((doc) => ({
      id: doc._id,
      title: doc.title,
      author: doc.author,
      coverImage: doc.coverImage,
      year: doc.year,
      subjects: doc.subjects,
      key: doc.key,
      savedAt: doc.savedAt,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load saved books." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { book?: Book };
    if (!body.book) {
      return NextResponse.json(
        { error: "Body must include a book payload." },
        { status: 400 },
      );
    }

    const { book } = body;

    const payload: SavedBook = {
      ...book,
      savedAt: new Date().toISOString(),
    };

    const result = await createDocument(payload);

    return NextResponse.json({
      id: result.id,
      rev: result.rev,
      savedAt: payload.savedAt,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error when saving the book.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
