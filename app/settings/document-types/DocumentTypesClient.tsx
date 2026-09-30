"use client";

import { useState, type FormEvent } from "react";

type Language = {
  id: number;
  name: string;
  status: boolean;
};

type DocumentLanguage = {
  languageId: number;
  language: Language;
  price: number | string;
};

type DocumentType = {
  id: number;
  name: string;
  description: string | null;
  defaultAmount: number;
  status: boolean;
  languages: DocumentLanguage[];
};

type Props = {
  initialDocumentTypes: DocumentType[];
  initialLanguages: Language[];
};

type LanguageDraft = {
  languageId: number;
  name: string;
  status: boolean;
  price: string;
  selected: boolean;
  custom: boolean;
};

type StatusFilter = "ACTIVE" | "INACTIVE" | "ALL";

type DocumentTypeGroup = DocumentType & {
  sourceIds: number[];
};

const formatMoney = (value: number) =>
  value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DocumentTypesClient({
  initialDocumentTypes,
  initialLanguages,
}: Props) {
  const [documentTypes, setDocumentTypes] =
    useState<DocumentType[]>(initialDocumentTypes);

  const [languages, setLanguages] = useState<Language[]>(initialLanguages);

  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageTarget, setLanguageTarget] = useState<"document" | "global" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [languageDrafts, setLanguageDrafts] = useState<LanguageDraft[]>([]);

  const [newLanguageName, setNewLanguageName] = useState("");
  const [loading, setLoading] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);

  const [documentStatusFilter, setDocumentStatusFilter] =
    useState<StatusFilter>("ACTIVE");
  const [languageStatusFilter, setLanguageStatusFilter] =
    useState<StatusFilter>("ACTIVE");

  // Older data may contain document names such as
  // "Birth certificate - Arabic" and "Birth certificate - English".
  // They are still one logical document type, so group them by the
  // base name and combine their language/pricing records for display.
  const documentTypeGroups = documentTypes.reduce<DocumentTypeGroup[]>(
    (groups, documentType) => {
      const normalizedName = documentType.name.trim().toLowerCase();
      const matchedLanguage = [...languages]
        .sort((a, b) => b.name.length - a.name.length)
        .find((language) =>
          normalizedName.endsWith(` - ${language.name.trim().toLowerCase()}`)
        );

      const baseName = matchedLanguage
        ? documentType.name
            .trim()
            .slice(0, -(matchedLanguage.name.trim().length + 3))
            .trim()
        : documentType.name.trim();

      const groupKey = baseName.toLowerCase();
      const existingGroup = groups.find(
        (group) => group.name.trim().toLowerCase() === groupKey
      );

      if (!existingGroup) {
        groups.push({
          ...documentType,
          name: baseName,
          sourceIds: [documentType.id],
          languages: [...documentType.languages],
        });
        return groups;
      }

      existingGroup.sourceIds.push(documentType.id);
      existingGroup.status = existingGroup.status || documentType.status;

      if (!existingGroup.description && documentType.description) {
        existingGroup.description = documentType.description;
      }

      // Keep the first configured price for each language. If an older
      // duplicate has the language-specific name suffix, prefer that
      // record's price for the matching language.
      for (const item of documentType.languages) {
        const existingLanguageIndex = existingGroup.languages.findIndex(
          (existingItem) => existingItem.languageId === item.languageId
        );

        if (existingLanguageIndex === -1) {
          existingGroup.languages.push(item);
          continue;
        }

        const sourceName = documentType.name.trim().toLowerCase();
        const languageName = item.language.name.trim().toLowerCase();

        if (sourceName.endsWith(` - ${languageName}`)) {
          existingGroup.languages[existingLanguageIndex] = item;
        }
      }

      return groups;
    },
    []
  );  

  const filteredDocumentTypes = documentTypeGroups.filter((item) => {
    if (documentStatusFilter === "ACTIVE") return item.status;
    if (documentStatusFilter === "INACTIVE") return !item.status;
    return true;
  });

  const filteredLanguages = languages.filter((item) => {
    if (languageStatusFilter === "ACTIVE") return item.status;
    if (languageStatusFilter === "INACTIVE") return !item.status;
    return true;
  });

  const resetDocumentForm = () => {
    setName("");
    setDefaultAmount("");
    setLanguageDrafts([]);
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetDocumentForm();

    const defaultPrice = "";
    setLanguageDrafts(
      languages.map((language) => ({
        languageId: language.id,
        name: language.name,
        status: language.status,
        price: defaultPrice,
        selected: language.status,
        custom: false,
      }))
    );

    setOpen(true);
  };

  const handleOpenEdit = (documentType: DocumentType) => {
    setEditingId(documentType.id);
    setName(documentType.name);
    setDefaultAmount(documentType.defaultAmount.toFixed(2));

    const byLanguageId = new Map(
      documentType.languages.map((item) => [
        item.languageId,
        item,
      ])
    );

    setLanguageDrafts(
      languages.map((language) => {
        const existing = byLanguageId.get(language.id);

        return {
          languageId: language.id,
          name: language.name,
          status: language.status,
          price: existing
            ? Number(existing.price).toFixed(2)
            : documentType.defaultAmount.toFixed(2),
          selected: language.status
            ? true
            : Boolean(existing),
          custom: existing
            ? Number(existing.price) !==
              Number(documentType.defaultAmount)
            : false,
        };
      })
    );

    setOpen(true);
  };

  const handleClose = () => {
    if (loading) return;

    setOpen(false);
    resetDocumentForm();
  };

  const handleDefaultAmountChange = (
    value: string
  ) => {
    setDefaultAmount(value);

    setLanguageDrafts((current) =>
      current.map((item) =>
        item.custom
          ? item
          : {
              ...item,
              price: value,
            }
      )
    );
  };

  const updateLanguagePrice = (
    languageId: number,
    price: string
  ) => {
    const cleanDefault =
      Number(defaultAmount || "0");

    const cleanPrice = Number(price);

    setLanguageDrafts((current) =>
      current.map((item) =>
        item.languageId === languageId
          ? {
              ...item,
              price,
              custom:
                price.trim() === "" ||
                !Number.isFinite(cleanPrice) ||
                !Number.isFinite(cleanDefault) ||
                cleanPrice !== cleanDefault,
            }
          : item
      )
    );
  };

  const toggleLanguage = (languageId: number) => {
    setLanguageDrafts((current) =>
      current.map((item) =>
        item.languageId === languageId
          ? {
              ...item,
              selected: !item.selected,
              price:
                !item.selected && !item.price.trim()
                  ? defaultAmount
                  : item.price,
              custom:
                !item.selected && !item.price.trim()
                  ? false
                  : item.custom,
            }
          : item
      )
    );
  };

  const applyDefaultPriceToAll = () => {
    const clean = defaultAmount.trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) {
      alert("Enter a valid default price first.");
      return;
    }

    setLanguageDrafts((current) =>
      current.map((item) =>
        item.selected
          ? {
              ...item,
              price: Number(clean).toFixed(2),
              custom: false,
            }
          : item
      )
    );
  };

  const selectAllLanguages = () => {
    setLanguageDrafts((current) =>
      current.map((item) => ({
        ...item,
        selected: item.status || item.selected,
        price:
          item.status && !item.price.trim()
            ? defaultAmount
            : item.price,
      }))
    );
  };

  const clearAllLanguages = () => {
    setLanguageDrafts((current) =>
      current.map((item) => ({
        ...item,
        selected: false,
      }))
    );
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) return;

    const cleanName = name.trim();
    const cleanAmount = defaultAmount.trim();

    if (!cleanName) {
      alert("Document type name is required.");
      return;
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(cleanAmount)) {
      alert("Valid default price is required.");
      return;
    }

    const selectedLanguages = languageDrafts.filter(
      (item) => item.selected
    );

    for (const item of selectedLanguages) {
      if (
        !/^\d+(?:\.\d{1,2})?$/.test(
          item.price.trim()
        )
      ) {
        alert(
          `Enter a valid price for ${item.name}.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const isEditing = editingId !== null;

      const response = await fetch(
        isEditing
          ? `/api/document-types/${editingId}`
          : "/api/document-types",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cleanName,
            defaultAmount: cleanAmount,
            languages: selectedLanguages.map((item) => ({
              languageId: item.languageId,
              price: item.price.trim(),
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(
          data.message ||
            `Unable to save document type. HTTP ${response.status}`
        );
        return;
      }

      if (!data.documentType) {
        alert(
          "Server did not return the saved document type."
        );
        return;
      }

      const saved = data.documentType as DocumentType;

      setDocumentTypes((current) => {
        const next = isEditing
          ? current.map((item) =>
              item.id === saved.id ? saved : item
            )
          : [...current, saved];

        return next.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });

      setOpen(false);
      resetDocumentForm();
    } catch (error) {
      console.error(
        "Save document type error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (
    documentType: DocumentTypeGroup
  ) => {
    const nextStatus = !documentType.status;

    if (!nextStatus) {
      const confirmed = window.confirm(
        `Deactivate "${documentType.name}"?\n\n` +
          "It will no longer be available when adding new documents to client files."
      );

      if (!confirmed) return;
    }

    setLoading(true);

    try {
      for (const sourceId of documentType.sourceIds) {
        const response = await fetch(
          `/api/document-types/${sourceId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: nextStatus,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          alert(
            data.message ||
              `Unable to update document type. HTTP ${response.status}`
          );
          return;
        }

        if (data.documentType) {
          const saved = data.documentType as DocumentType;

          setDocumentTypes((current) =>
            current.map((item) =>
              item.id === saved.id ? saved : item
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "Toggle document type status error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLanguageAdd = (target: "document" | "global") => {
    setNewLanguageName("");
    setLanguageTarget(target);
    setLanguageOpen(true);
  };

  const handleCloseLanguageAdd = () => {
    if (languageSaving) return;
    setLanguageOpen(false);
    setLanguageTarget(null);
    setNewLanguageName("");
  };

  const handleCreateLanguage = async () => {
    if (languageSaving) return;

    const cleanName = newLanguageName.trim();

    if (!cleanName) {
      alert("Language name is required.");
      return;
    }

    setLanguageSaving(true);

    try {
      const response = await fetch("/api/languages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(
          data.message ||
            "Unable to create language."
        );
        return;
      }

      const savedLanguage = data.language as Language;

      setLanguages((current) =>
        [...current, savedLanguage].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setDocumentTypes((current) =>
        current.map((documentType) => ({
          ...documentType,
          languages: [
            ...documentType.languages,
            {
              languageId: savedLanguage.id,
              language: savedLanguage,
              price: documentType.defaultAmount,
            },
          ],
        })),
      );

      setLanguageDrafts((current) =>
        [...current, {
          languageId: savedLanguage.id,
          name: savedLanguage.name,
          status: savedLanguage.status,
          price: defaultAmount || "0.00",
          selected: true,
          custom: false,
        }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      // Keep the language window open so multiple languages can be added.
      // If this was opened from the Document Type form, that form also stays open.
      setNewLanguageName("");
    } catch (error) {
      console.error("Create language error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLanguageSaving(false);
    }
  };

  const handleToggleLanguageStatus = async (
    language: Language
  ) => {
    const nextStatus = !language.status;

    if (!nextStatus) {
      const confirmed = window.confirm(
        `Deactivate "${language.name}"?\n\n` +
          "It will no longer be available for new translation documents. Existing files will keep their saved language."
      );

      if (!confirmed) return;
    }

    setLanguageSaving(true);

    try {
      const response = await fetch(
        `/api/languages/${language.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(
          data.message ||
            "Unable to update language."
        );
        return;
      }

      const saved = data.language as Language;

      setLanguages((current) =>
        current.map((item) =>
          item.id === saved.id ? saved : item
        )
      );

      setDocumentTypes((current) =>
        current.map((documentType) => ({
          ...documentType,
          languages: documentType.languages.map(
            (item) =>
              item.languageId === saved.id
                ? {
                    ...item,
                    language: saved,
                  }
                : item
          ),
        }))
      );

      setLanguageDrafts((current) =>
        current.map((item) =>
          item.languageId === saved.id
            ? {
                ...item,
                status: saved.status,
              }
            : item
        )
      );
    } catch (error) {
      console.error(
        "Toggle language status error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLanguageSaving(false);
    }
  };

  return (
    <>
      {/* Document Types */}
      <div className="mt-8 overflow-hidden rounded-xl border border-black/10 bg-white">
        <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Document Types
            </h2>
            <p className="mt-1 text-xs text-black/40">
              Reusable document types with language-specific translation prices.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={documentStatusFilter}
              onChange={(event) =>
                setDocumentStatusFilter(
                  event.target.value as StatusFilter
                )
              }
              className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              aria-label="Filter document types by status"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>

            <button
              type="button"
              onClick={handleOpenAdd}
              disabled={languageSaving}
              className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
            >
              + Add Document Type
            </button>
          </div>
        </div>

        {filteredDocumentTypes.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center px-6">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
                <span className="text-lg text-black/30">
                  +
                </span>
              </div>

              <p className="mt-4 text-sm font-medium text-black/50">
                No document types yet
              </p>

              <p className="mt-1 text-xs text-black/30">
                Add your first document type to get started.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-black/10 bg-[#fafaf9]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Document Type
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Languages
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Default Price
                  </th>
                  <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDocumentTypes.map((documentType) => (
                  <tr
                    key={documentType.id}
                    className="border-b border-black/5 last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium">
                        {documentType.name}
                      </p>
                      <p className="mt-1 max-w-md text-xs text-black/35">
                        {documentType.description || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex max-w-[360px] flex-wrap gap-1.5">
                        {documentType.languages.length === 0 ? (
                          <span className="text-xs text-black/35">
                            No languages configured
                          </span>
                        ) : (
                          documentType.languages.map((item) => (
                            <span
                              key={item.languageId}
                              className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] text-black/60"
                            >
                              <span>{item.language.name}</span>
                              <span className="font-semibold text-black/70">
                                LKR {formatMoney(Number(item.price))}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right text-xs font-semibold text-black/70">
                      LKR {formatMoney(documentType.defaultAmount)}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                          documentType.status
                            ? "bg-green-100 text-green-700"
                            : "bg-black/5 text-black/40"
                        }`}
                      >
                        {documentType.status
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenEdit(documentType)
                          }
                          disabled={loading || languageSaving}
                          className="text-xs font-medium text-black/45 transition hover:text-black disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(documentType)
                          }
                          disabled={loading}
                          className={`text-xs font-medium transition disabled:opacity-50 ${
                            documentType.status
                              ? "text-red-500 hover:text-red-700"
                              : "text-green-600 hover:text-green-700"
                          }`}
                        >
                          {documentType.status
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Languages */}
      <div className="mt-8 overflow-hidden rounded-xl border border-black/10 bg-white">
        <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Languages
            </h2>
            <p className="mt-1 text-xs text-black/40">
              Add languages used by your translation services. There is no fixed language limit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={languageStatusFilter}
              onChange={(event) =>
                setLanguageStatusFilter(
                  event.target.value as StatusFilter
                )
              }
              className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              aria-label="Filter languages by status"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>

            <button
              type="button"
              onClick={() => handleOpenLanguageAdd("global")}
              className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
            >
              + Add Language
            </button>
          </div>
        </div>

        {filteredLanguages.length === 0 ? (
          <div className="px-5 py-6">
            <p className="text-xs text-black/40">
              No languages match the selected filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b border-black/10 bg-[#fafaf9]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Language
                  </th>
                  <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredLanguages.map((language) => (
                  <tr
                    key={language.id}
                    className="border-b border-black/5 last:border-b-0"
                  >
                    <td className="px-5 py-4 text-sm font-medium">
                      {language.name}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                          language.status
                            ? "bg-green-100 text-green-700"
                            : "bg-black/5 text-black/40"
                        }`}
                      >
                        {language.status
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleLanguageStatus(language)
                        }
                        disabled={languageSaving}
                        className={
                          language.status
                            ? "text-xs font-medium text-red-500 transition hover:text-red-700 disabled:opacity-50"
                            : "text-xs font-medium text-green-600 transition hover:text-green-700 disabled:opacity-50"
                        }
                      >
                        {language.status
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Language Add Window */}
      {languageOpen && languageTarget === "global" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Add Languages</h2>
                <p className="mt-1 text-[11px] text-black/40">
                  Add multiple languages. This window stays open until you close it.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseLanguageAdd}
                disabled={languageSaving}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-black/40 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <div className="flex gap-2">
                <input
                  id="new-global-language"
                  autoFocus
                  value={newLanguageName}
                  onChange={(event) => setNewLanguageName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateLanguage();
                    }
                  }}
                  placeholder="Language name, e.g. Tamil"
                  disabled={languageSaving}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() => void handleCreateLanguage()}
                  disabled={languageSaving}
                  className="shrink-0 rounded-lg bg-black px-4 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {languageSaving ? "Adding..." : "Add"}
                </button>
              </div>

              <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-black/10 bg-[#fafaf9]">
                {languages.length === 0 ? (
                  <p className="px-4 py-5 text-center text-xs text-black/35">
                    No languages added yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-px bg-black/5">
                    {languages.map((language) => (
                      <div
                        key={language.id}
                        className="bg-white px-3 py-2.5 text-xs font-medium"
                      >
                        {language.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Type Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  {editingId !== null
                    ? "Edit Document Type"
                    : "Add Document Type"}
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Configure the document, default price, and language-specific prices.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-black/40 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto px-6 py-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/60">
                    Document Type
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="e.g. Birth Certificate"
                    required
                    disabled={loading}
                    className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/60">
                    Default Translation Price (LKR)
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={defaultAmount}
                      onChange={(event) =>
                        handleDefaultAmountChange(
                          event.target.value
                        )
                      }
                      placeholder="e.g. 6500.00"
                      required
                      disabled={loading}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                    />

                    <button
                      type="button"
                      onClick={applyDefaultPriceToAll}
                      disabled={loading}
                      className="shrink-0 rounded-lg border border-black/10 px-3 text-[11px] font-semibold text-black/55 transition hover:border-[#f9a800] hover:bg-[#f9a800]/10 hover:text-black disabled:opacity-50"
                    >
                      Apply to All
                    </button>
                  </div>

                  <p className="mt-1.5 text-[10px] text-black/35">
                    New language prices start from this value.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-black/10 bg-[#fafaf9]">
                <div className="flex flex-col gap-3 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold">
                      Translation Languages
                    </p>
                    <p className="mt-1 text-[10px] text-black/35">
                      Select the languages this document can be translated into and set each language price.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllLanguages}
                      disabled={loading || languages.length === 0}
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold hover:border-[#f9a800] hover:bg-[#f9a800]/10 disabled:opacity-50"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={clearAllLanguages}
                      disabled={loading || languages.length === 0}
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold hover:border-black/20 hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      Clear All
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLanguageAdd("document")}
                      disabled={loading || languageSaving}
                      className="rounded-lg bg-black px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                    >
                      + Add Language
                    </button>
                  </div>
                </div>

                {languageOpen && languageTarget === "document" && (
                  <div className="border-b border-black/10 bg-white px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <label
                          className="sr-only"
                          htmlFor="new-document-type-language"
                        >
                          New Language
                        </label>
                        <input
                          id="new-document-type-language"
                          autoFocus
                          value={newLanguageName}
                          onChange={(event) =>
                            setNewLanguageName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleCreateLanguage();
                            }
                          }}
                          placeholder="New language, e.g. Tamil"
                          disabled={languageSaving}
                          className="h-9 w-full rounded-lg border border-black/10 bg-white px-3 text-xs outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:opacity-50"
                        />
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={handleCloseLanguageAdd}
                          disabled={languageSaving}
                          className="rounded-lg border border-black/10 px-3 py-2 text-[11px] font-medium text-black/50 hover:bg-black/5 hover:text-black disabled:opacity-50"
                        >
                          Close
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleCreateLanguage()}
                          disabled={languageSaving}
                          className="rounded-lg bg-black px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                        >
                          {languageSaving ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {languageDrafts.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs font-medium text-black/45">
                      No languages available.
                    </p>
                    <p className="mt-1 text-[10px] text-black/30">
                      Add a language first, then configure its price here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-black/5">
                    <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
                      {languageDrafts.map((item) => (
                        <div
                          key={item.languageId}
                          className={`flex min-w-0 items-center gap-2 border-b border-black/5 px-4 py-2.5 sm:border-r [&:nth-child(even)]:border-r-0 ${
                            !item.status ? "opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() =>
                              toggleLanguage(item.languageId)
                            }
                            disabled={
                              loading || !item.status
                            }
                            className="h-4 w-4 shrink-0"
                          />

                          <p className="min-w-0 flex-1 truncate text-xs font-medium" title={item.name}>
                            {item.name}
                          </p>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(event) =>
                              updateLanguagePrice(
                                item.languageId,
                                event.target.value
                              )
                            }
                            disabled={loading || !item.selected}
                            placeholder="0.00"
                            className="h-9 w-[105px] shrink-0 rounded-lg border border-black/10 bg-white px-2.5 text-xs outline-none focus:border-[#f9a800] disabled:bg-black/[0.03] disabled:opacity-50"
                          />

                          {item.price.trim() &&
                            /^\d+(?:\.\d{1,2})?$/.test(
                              item.price.trim()
                            ) &&
                            Number(item.price) !==
                              Number(defaultAmount || "0") && (
                              <span className="hidden text-[9px] font-medium text-[#a66f00] xl:inline">
                                Custom
                              </span>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-black/10 bg-white px-4 py-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-black/35">
                      Selected Languages
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {
                        languageDrafts.filter(
                          (item) => item.selected
                        ).length
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-black/35">
                      Minimum Price
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      LKR{" "}
                      {formatMoney(
                        languageDrafts
                          .filter((item) => item.selected)
                          .map((item) => Number(item.price) || 0)
                          .reduce(
                            (minimum, value, index) =>
                              index === 0
                                ? value
                                : Math.min(minimum, value),
                            0
                          )
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-black/35">
                      Maximum Price
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      LKR{" "}
                      {formatMoney(
                        languageDrafts
                          .filter((item) => item.selected)
                          .map((item) => Number(item.price) || 0)
                          .reduce(
                            (maximum, value) => Math.max(maximum, value),
                            0
                          )
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading
                    ? "Saving..."
                    : editingId !== null
                      ? "Save Changes"
                      : "Add Document Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
