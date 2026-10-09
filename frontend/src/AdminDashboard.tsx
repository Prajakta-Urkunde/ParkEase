import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getAdminVerification,
  getAdminVerificationDocument,
  getAdminVerifications,
  reviewAdminVerification,
  type AdminVerificationApplication,
  type AdminVerificationStatus,
  type OwnerVerificationDocument,
  type VerificationReviewDecision,
} from "./services/api";
import { useAuth } from "./context/AuthContext";
import "./AdminDashboard.css";

const STATUS_LABELS: Record<AdminVerificationStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  NEEDS_MORE_INFORMATION: "Needs more information",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

type ReviewDialogState = {
  status: VerificationReviewDecision;
  title: string;
  explanation: string;
  requiresNotes: boolean;
};

type DocumentPreview = {
  documentId: number;
  filename: string;
  mimeType: string;
  objectUrl: string;
};

const REVIEW_DIALOGS: Partial<Record<VerificationReviewDecision, ReviewDialogState>> = {
  UNDER_REVIEW: {
    status: "UNDER_REVIEW",
    title: "Mark application under review",
    explanation: "Confirm that you want to begin reviewing this property application.",
    requiresNotes: false,
  },
  VERIFIED: {
    status: "VERIFIED",
    title: "Approve application",
    explanation: "Confirm that the submitted evidence has been reviewed and the property is eligible for parking listings.",
    requiresNotes: false,
  },
  NEEDS_MORE_INFORMATION: {
    status: "NEEDS_MORE_INFORMATION",
    title: "Request more information",
    explanation: "Explain what additional documents or corrections are needed.",
    requiresNotes: true,
  },
  REJECTED: {
    status: "REJECTED",
    title: "Reject application",
    explanation: "Provide a clear reason. The owner will see this note and may submit a corrected application.",
    requiresNotes: true,
  },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<AdminVerificationApplication[]>([]);
  const [selectedApplication, setSelectedApplication] =
    useState<AdminVerificationApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminVerificationStatus>("ALL");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [documentLoading, setDocumentLoading] = useState<number | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewTarget, setPreviewTarget] = useState<OwnerVerificationDocument | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [dialog, setDialog] = useState<ReviewDialogState | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const objectUrlsRef = useRef(new Set<string>());
  const loadedObjectUrlsRef = useRef(new Set<string>());
  const revokeTimersRef = useRef(new Map<string, number>());

  const loadApplications = useCallback(async () => {
    try {
      setLoadError("");
      setIsLoading(true);
      const result = await getAdminVerifications();
      setApplications(result);
      setSelectedApplication((current) =>
        current ? result.find((item) => item.id === current.id) ?? null : null
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load property verification applications."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    return () => {
      if (!preview) return;
      const timeout = window.setTimeout(() => {
        URL.revokeObjectURL(preview.objectUrl);
        objectUrlsRef.current.delete(preview.objectUrl);
        revokeTimersRef.current.delete(preview.objectUrl);
      }, 30_000);
      revokeTimersRef.current.set(preview.objectUrl, timeout);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      revokeTimersRef.current.forEach((timeout) => window.clearTimeout(timeout));
      objectUrlsRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      revokeTimersRef.current.clear();
      objectUrlsRef.current.clear();
      loadedObjectUrlsRef.current.clear();
    };
  }, []);

  const filteredApplications = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return applications.filter((application) => {
      if (statusFilter !== "ALL" && application.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [
        application.id,
        application.owner_name,
        application.owner_email,
        application.property_name,
        application.property_address,
        application.property_relationship,
        application.property_identifier,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [applications, search, statusFilter]);

  const summary = useMemo(
    () => ({
      pending: applications.filter((item) => item.status === "PENDING").length,
      underReview: applications.filter((item) => item.status === "UNDER_REVIEW").length,
      verified: applications.filter((item) => item.status === "VERIFIED").length,
      rejected: applications.filter((item) => item.status === "REJECTED").length,
    }),
    [applications]
  );

  async function selectApplication(application: AdminVerificationApplication) {
    setSelectedApplication(application);
    setFeedback("");
    setActionError("");
    setPreview(null);
    setPreviewTarget(null);
    setPreviewError("");
    try {
      setDetailLoading(true);
      const detail = await getAdminVerification(application.id);
      setSelectedApplication(detail);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to load application details."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function inspectDocument(document: OwnerVerificationDocument) {
    setDocumentLoading(document.id);
    setActionError("");
    setPreviewTarget(document);
    setPreviewError("");
    setPreview(null);
    try {
      const blob = await getAdminVerificationDocument(document.id);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.add(objectUrl);
      loadedObjectUrlsRef.current.delete(objectUrl);
      setPreview({
        documentId: document.id,
        filename: document.filename,
        mimeType: blob.type,
        objectUrl,
      });
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Unable to retrieve the document."
      );
    } finally {
      setDocumentLoading(null);
    }
  }

  async function downloadDocument(document: OwnerVerificationDocument) {
    setDocumentLoading(document.id);
    setActionError("");
    try {
      const blob = await getAdminVerificationDocument(document.id);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.add(objectUrl);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = document.filename;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      const timeout = window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        objectUrlsRef.current.delete(objectUrl);
        revokeTimersRef.current.delete(objectUrl);
      }, 60_000);
      revokeTimersRef.current.set(objectUrl, timeout);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to download the document."
      );
    } finally {
      setDocumentLoading(null);
    }
  }

  function markPreviewLoaded(currentObjectUrl: string) {
    loadedObjectUrlsRef.current.add(currentObjectUrl);
    objectUrlsRef.current.forEach((objectUrl) => {
      if (
        objectUrl === currentObjectUrl ||
        !loadedObjectUrlsRef.current.has(objectUrl)
      ) {
        return;
      }
      const timeout = revokeTimersRef.current.get(objectUrl);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        revokeTimersRef.current.delete(objectUrl);
      }
      URL.revokeObjectURL(objectUrl);
      objectUrlsRef.current.delete(objectUrl);
      loadedObjectUrlsRef.current.delete(objectUrl);
    });
  }

  function openReviewDialog(status: VerificationReviewDecision) {
    const nextDialog = REVIEW_DIALOGS[status];
    if (!nextDialog || actionInProgress) return;
    setDialog(nextDialog);
    setReviewNotes("");
    setActionError("");
  }

  async function submitReviewDecision() {
    if (!dialog || !selectedApplication || actionInProgress) return;
    const notes = reviewNotes.trim();
    if (dialog.requiresNotes && !notes) {
      setActionError("Provide an explanation before submitting this decision.");
      return;
    }
    setActionInProgress(true);
    setActionError("");
    try {
      await reviewAdminVerification(
        selectedApplication.id,
        dialog.status,
        notes || undefined
      );
      setFeedback(`Application #${selectedApplication.id}: ${STATUS_LABELS[dialog.status]}.`);
      setDialog(null);
      setReviewNotes("");
      await loadApplications();
      const refreshed = await getAdminVerification(selectedApplication.id);
      setSelectedApplication(refreshed);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to save this review decision."
      );
    } finally {
      setActionInProgress(false);
    }
  }

  const isUnderReview = selectedApplication?.status === "UNDER_REVIEW";
  const canMarkUnderReview =
    selectedApplication?.status === "PENDING" || selectedApplication?.status === "VERIFIED";

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div className="admin-dashboard__brand-row">
          <button
            className="admin-dashboard__brand"
            type="button"
            onClick={() => navigate("/")}
            aria-label="ParkEase home"
          >
            <span className="admin-dashboard__brand-mark">P</span>
            <span>ParkEase</span>
          </button>
          <div className="admin-dashboard__account">
            <span>{user?.name}</span>
            <button type="button" onClick={logout}>Log out</button>
          </div>
        </div>
        <div className="admin-dashboard__heading">
          <div>
            <p className="admin-dashboard__eyebrow">Property eligibility</p>
            <h1>Admin Dashboard</h1>
            <p>Review property ownership and parking authorization</p>
          </div>
          <button type="button" className="admin-dashboard__refresh" onClick={() => void loadApplications()} disabled={isLoading}>
            {isLoading ? "Refreshing…" : "Refresh applications"}
          </button>
        </div>
      </header>

      <section className="admin-dashboard__summary" aria-label="Application summary">
        <article className="admin-dashboard__summary-card admin-dashboard__summary-card--pending">
          <span>Pending Applications</span>
          <strong>{isLoading ? "—" : summary.pending}</strong>
        </article>
        <article className="admin-dashboard__summary-card admin-dashboard__summary-card--review">
          <span>Under Review</span>
          <strong>{isLoading ? "—" : summary.underReview}</strong>
        </article>
        <article className="admin-dashboard__summary-card admin-dashboard__summary-card--verified">
          <span>Verified Owners</span>
          <strong>{isLoading ? "—" : summary.verified}</strong>
        </article>
        <article className="admin-dashboard__summary-card admin-dashboard__summary-card--rejected">
          <span>Rejected Applications</span>
          <strong>{isLoading ? "—" : summary.rejected}</strong>
        </article>
      </section>

      {feedback && <p className="admin-dashboard__feedback" role="status">{feedback}</p>}
      {loadError && (
        <div className="admin-dashboard__error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadApplications()}>Retry</button>
        </div>
      )}

      <section className="admin-dashboard__workspace">
        <div className="admin-dashboard__applications">
          <div className="admin-dashboard__list-heading">
            <div>
              <h2>Verification applications</h2>
              <p>{filteredApplications.length} matching applications</p>
            </div>
          </div>

          <div className="admin-dashboard__filters">
            <label>
              <span className="admin-dashboard__visually-hidden">Search applications</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search owner, property, address…"
              />
            </label>
            <label>
              <span className="admin-dashboard__visually-hidden">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "ALL" | AdminVerificationStatus)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="NEEDS_MORE_INFORMATION">Needs more information</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          </div>

          {isLoading && applications.length === 0 ? (
            <div className="admin-dashboard__state">Loading verification applications…</div>
          ) : !loadError && filteredApplications.length === 0 ? (
            <div className="admin-dashboard__state">
              {applications.length === 0
                ? "No property verification applications have been submitted."
                : "No applications match your search and status filter."}
            </div>
          ) : (
            <div className="admin-dashboard__table-wrap">
              <table className="admin-dashboard__table">
                <thead>
                  <tr>
                    <th scope="col">Application</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Property</th>
                    <th scope="col">Relationship</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="admin-dashboard__visually-hidden">Review</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => (
                    <tr
                      key={application.id}
                      className={selectedApplication?.id === application.id ? "is-selected" : ""}
                    >
                      <td data-label="Application">#{application.id}</td>
                      <td data-label="Owner">
                        <strong>{application.owner_name || "Unknown owner"}</strong>
                        {application.owner_email && <small>{application.owner_email}</small>}
                      </td>
                      <td data-label="Property">
                        <strong>{application.property_name}</strong>
                        <small>{application.property_address}</small>
                      </td>
                      <td data-label="Relationship">
                        {(application.property_relationship ?? "UNKNOWN").replaceAll("_", " ")}
                      </td>
                      <td data-label="Submitted">{formatDate(application.submitted_at)}</td>
                      <td data-label="Status">
                        <span className={`admin-dashboard__status admin-dashboard__status--${application.status.toLowerCase()}`}>
                          {STATUS_LABELS[application.status]}
                        </span>
                      </td>
                      <td data-label="Review">
                        <button
                          type="button"
                          className="admin-dashboard__view-button"
                          onClick={() => void selectApplication(application)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="admin-dashboard__detail" aria-label="Application details">
          {!selectedApplication ? (
            <div className="admin-dashboard__detail-empty">
              <h2>Application details</h2>
              <p>Select an application to inspect its property information and evidence.</p>
            </div>
          ) : (
            <>
              <div className="admin-dashboard__detail-heading">
                <div>
                  <p className="admin-dashboard__eyebrow">Application #{selectedApplication.id}</p>
                  <h2>{selectedApplication.property_name}</h2>
                </div>
                <button type="button" aria-label="Close application details" onClick={() => setSelectedApplication(null)}>×</button>
              </div>

              {detailLoading ? (
                <p className="admin-dashboard__state">Loading application details…</p>
              ) : (
                <>
                  <span className={`admin-dashboard__status admin-dashboard__status--${selectedApplication.status.toLowerCase()}`}>
                    {STATUS_LABELS[selectedApplication.status]}
                  </span>
                  <dl className="admin-dashboard__property-details">
                    <div><dt>Owner</dt><dd>{selectedApplication.owner_name || "Unknown owner"}</dd></div>
                    <div><dt>Contact email</dt><dd>{selectedApplication.owner_email || "Not available"}</dd></div>
                    <div><dt>Property address</dt><dd>{selectedApplication.property_address}</dd></div>
                    <div><dt>Relationship</dt><dd>{(selectedApplication.property_relationship ?? "UNKNOWN").replaceAll("_", " ")}</dd></div>
                    {selectedApplication.property_identifier && (
                      <div><dt>Property identifier</dt><dd>{selectedApplication.property_identifier}</dd></div>
                    )}
                    <div><dt>Map location</dt><dd>{selectedApplication.latitude}, {selectedApplication.longitude}</dd></div>
                    <div><dt>Submitted</dt><dd>{formatDate(selectedApplication.submitted_at)}</dd></div>
                    {selectedApplication.review_notes && (
                      <div><dt>Previous review note</dt><dd>{selectedApplication.review_notes}</dd></div>
                    )}
                  </dl>

                  <section className="admin-dashboard__documents">
                    <h3>Submitted documents</h3>
                    {selectedApplication.documents.length === 0 ? (
                      <p>No documents attached.</p>
                    ) : (
                      <ul>
                        {selectedApplication.documents.map((document) => (
                          <li key={document.id}>
                            <div className="admin-dashboard__document-name">
                              <strong>{document.filename}</strong>
                              <small>{formatFileSize(document.size_bytes)} · {document.mime_type}</small>
                            </div>
                            <div className="admin-dashboard__document-actions">
                              <button
                                type="button"
                                onClick={() => void inspectDocument(document)}
                                disabled={documentLoading !== null}
                              >
                                {documentLoading === document.id ? "Loading…" : "View"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void downloadDocument(document)}
                                disabled={documentLoading !== null}
                              >
                                Download
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {preview && (
                    <section className="admin-dashboard__preview" aria-label={`Preview of ${preview.filename}`}>
                      <div className="admin-dashboard__preview-heading">
                        <h3>{preview.filename}</h3>
                        <button type="button" onClick={() => setPreview(null)}>Close preview</button>
                      </div>
                      {preview.mimeType === "application/pdf" ? (
                        <iframe
                          key={preview.objectUrl}
                          title={`Preview of ${preview.filename}`}
                          src={preview.objectUrl}
                          onLoad={() => markPreviewLoaded(preview.objectUrl)}
                        />
                      ) : (
                        <img
                          src={preview.objectUrl}
                          alt={`Submitted evidence: ${preview.filename}`}
                          onLoad={() => markPreviewLoaded(preview.objectUrl)}
                        />
                      )}
                    </section>
                  )}

                  {previewTarget && !preview && (
                    <section className="admin-dashboard__preview-error" role={previewError ? "alert" : "status"}>
                      <h3>{previewTarget.filename}</h3>
                      {previewError ? (
                        <>
                          <p>{previewError}</p>
                          <button
                            type="button"
                            onClick={() => void inspectDocument(previewTarget)}
                            disabled={documentLoading !== null}
                          >
                            Retry preview
                          </button>
                        </>
                      ) : (
                        <p>Loading secure document preview…</p>
                      )}
                      <button
                        type="button"
                        onClick={() => void downloadDocument(previewTarget)}
                        disabled={documentLoading !== null}
                      >
                        {documentLoading === previewTarget.id ? "Loading document…" : "Download document"}
                      </button>
                    </section>
                  )}

                  <section className="admin-dashboard__review-actions">
                    <h3>Review decision</h3>
                    {canMarkUnderReview && (
                      <button
                        type="button"
                        className="admin-dashboard__action admin-dashboard__action--neutral"
                        onClick={() => openReviewDialog("UNDER_REVIEW")}
                        disabled={actionInProgress}
                      >
                        Mark Under Review
                      </button>
                    )}
                    {isUnderReview && (
                      <div className="admin-dashboard__decision-buttons">
                        <button
                          type="button"
                          className="admin-dashboard__action admin-dashboard__action--approve"
                          onClick={() => openReviewDialog("VERIFIED")}
                          disabled={actionInProgress}
                        >
                          Approve Application
                        </button>
                        <button
                          type="button"
                          className="admin-dashboard__action admin-dashboard__action--request"
                          onClick={() => openReviewDialog("NEEDS_MORE_INFORMATION")}
                          disabled={actionInProgress}
                        >
                          Request More Information
                        </button>
                        <button
                          type="button"
                          className="admin-dashboard__action admin-dashboard__action--reject"
                          onClick={() => openReviewDialog("REJECTED")}
                          disabled={actionInProgress}
                        >
                          Reject Application
                        </button>
                      </div>
                    )}
                    {!canMarkUnderReview && !isUnderReview && (
                      <p className="admin-dashboard__action-help">
                        {selectedApplication.status === "NEEDS_MORE_INFORMATION"
                          ? "Waiting for the owner to submit additional information."
                          : "This application has a final decision. The owner may resubmit if eligible."}
                      </p>
                    )}
                  </section>
                </>
              )}

              {actionError && <p className="admin-dashboard__error-text" role="alert">{actionError}</p>}
            </>
          )}
        </aside>
      </section>

      {dialog && (
        <div className="admin-dashboard__dialog-backdrop" role="presentation">
          <section
            className="admin-dashboard__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
            aria-describedby="review-dialog-explanation"
          >
            <h2 id="review-dialog-title">{dialog.title}</h2>
            <p id="review-dialog-explanation">{dialog.explanation}</p>
            {dialog.requiresNotes && (
              <label>
                Explanation for owner
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  maxLength={2000}
                  rows={5}
                  required
                  autoFocus
                />
              </label>
            )}
            {actionError && <p className="admin-dashboard__error-text" role="alert">{actionError}</p>}
            <div className="admin-dashboard__dialog-actions">
              <button type="button" onClick={() => setDialog(null)} disabled={actionInProgress}>
                Cancel
              </button>
              <button
                type="button"
                className={`admin-dashboard__action admin-dashboard__action--${dialog.status === "VERIFIED" ? "approve" : dialog.status === "REJECTED" ? "reject" : dialog.status === "NEEDS_MORE_INFORMATION" ? "request" : "neutral"}`}
                onClick={() => void submitReviewDecision()}
                disabled={actionInProgress || (dialog.requiresNotes && !reviewNotes.trim())}
              >
                {actionInProgress ? "Saving…" : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default AdminDashboard;
