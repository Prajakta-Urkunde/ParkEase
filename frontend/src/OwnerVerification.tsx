import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  getOwnerVerification,
  submitOwnerVerification,
  type OwnerVerificationStatus,
  type OwnerVerificationSubmission,
} from "./services/api";
import "./OwnerVerification.css";

const STATUS_LABELS: Record<OwnerVerificationStatus["status"], string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending review",
  UNDER_REVIEW: "Under review",
  NEEDS_MORE_INFORMATION: "More information required",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

function OwnerVerification({
  notice,
  onStatusChange,
}: {
  notice?: string;
  onStatusChange: (status: OwnerVerificationStatus["status"]) => void;
}) {
  const [verification, setVerification] = useState<OwnerVerificationStatus | null>(null);
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyRelationship, setPropertyRelationship] =
    useState<OwnerVerificationSubmission["property_relationship"]>("OWNER");
  const [propertyIdentifier, setPropertyIdentifier] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [message, setMessage] = useState(notice ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const result = await getOwnerVerification();
      setVerification(result);
      onStatusChange(result.status);
      setPropertyName(result.property_name ?? "");
      setPropertyAddress(result.property_address ?? "");
      setPropertyRelationship(result.property_relationship ?? "OWNER");
      setPropertyIdentifier(result.property_identifier ?? "");
      setLatitude(result.latitude === null ? "" : String(result.latitude));
      setLongitude(result.longitude === null ? "" : String(result.longitude));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't load your property verification status."
      );
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (documents.length === 0) {
      setMessage("Select at least one property evidence document.");
      return;
    }
    if (documents.length > 8) {
      setMessage("You can submit up to 8 documents at a time.");
      return;
    }
    if (
      documents.some((file) => file.size > 10 * 1024 * 1024) ||
      documents.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024
    ) {
      setMessage("Each document must be 10 MB or smaller and all documents together must be 25 MB or smaller.");
      return;
    }
    if (!latitude.trim() || !longitude.trim()) {
      setMessage("Provide the property's map location.");
      return;
    }

    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    if (
      (latitudeValue !== undefined &&
        (!Number.isFinite(latitudeValue) || latitudeValue < -90 || latitudeValue > 90)) ||
      (longitudeValue !== undefined &&
        (!Number.isFinite(longitudeValue) || longitudeValue < -180 || longitudeValue > 180))
    ) {
      setMessage("Enter valid map coordinates.");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitOwnerVerification({
        property_name: propertyName.trim(),
        property_address: propertyAddress.trim(),
        property_relationship: propertyRelationship,
        property_identifier: propertyIdentifier.trim() || undefined,
        latitude: latitudeValue,
        longitude: longitudeValue,
        files: documents,
      });
      setVerification(result);
      onStatusChange(result.status);
      setDocuments([]);
      const input = document.getElementById("verification-documents") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("Your documents were submitted for manual review. This does not automatically prove ownership or authorize a listing.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your documents could not be submitted. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    !verification ||
    verification.status === "NOT_SUBMITTED" ||
    verification.status === "NEEDS_MORE_INFORMATION" ||
    verification.status === "REJECTED";

  return (
    <section className="owner-verification" aria-labelledby="owner-verification-title">
      <div className="owner-verification__header">
        <div>
          <p className="owner-verification__eyebrow">Property eligibility</p>
          <h2 id="owner-verification-title">Ownership &amp; authorization</h2>
        </div>
        {!isLoading && verification && (
          <span className={`owner-verification__badge owner-verification__badge--${verification.status.toLowerCase()}`}>
            {STATUS_LABELS[verification.status]}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="owner-verification__message">Loading verification status...</p>
      ) : verification ? (
        <>
          <div className="owner-verification__details">
            <div>
              <span>Property</span>
              <strong>{verification.property_name || "Not provided"}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{verification.property_address || "Not provided"}</strong>
            </div>
            <div>
              <span>Relationship</span>
              <strong>
                {verification.property_relationship
                  ? verification.property_relationship.replaceAll("_", " ")
                  : "Not provided"}
              </strong>
            </div>
            {verification.property_identifier && (
              <div>
                <span>Property identifier</span>
                <strong>{verification.property_identifier}</strong>
              </div>
            )}
          </div>

          <div className="owner-verification__next-step" role="status">
            {verification.status === "NOT_SUBMITTED" &&
              "Submit property details and evidence. You cannot publish parking lots until an authorized reviewer approves the application."}
            {verification.status === "PENDING" &&
              "Your application is waiting for review. You will be able to publish a parking lot after approval."}
            {verification.status === "UNDER_REVIEW" &&
              "An authorized reviewer is checking your application. Existing reservations remain unaffected."}
            {verification.status === "NEEDS_MORE_INFORMATION" &&
              "Add the requested information and evidence below, then resubmit for review."}
            {verification.status === "VERIFIED" &&
              "Your application was approved by an authorized reviewer. You may now create parking listings."}
            {verification.status === "REJECTED" &&
              "Your application was rejected. Review the note below, correct the information, and submit again if appropriate."}
          </div>

          {verification.review_notes && (
            <div className="owner-verification__review-note">
              <strong>Reviewer note</strong>
              <p>{verification.review_notes}</p>
            </div>
          )}

          <div className="owner-verification__documents">
            <strong>Documents submitted</strong>
            {verification.documents.length === 0 ? (
              <p>No documents submitted yet.</p>
            ) : (
              <ul>
                {verification.documents.map((file) => (
                  <li key={file.id}>
                    <span>{file.filename}</span>
                    <small>{(file.size_bytes / (1024 * 1024)).toFixed(2)} MB</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canSubmit && (
            <form className="owner-verification__form" onSubmit={handleSubmit}>
              <h3>{verification.status === "NOT_SUBMITTED" ? "Submit property details" : "Add documents and resubmit"}</h3>
              <div className="owner-verification__form-grid">
                <label>
                  Property name
                  <input
                    value={propertyName}
                    onChange={(event) => setPropertyName(event.target.value)}
                    maxLength={150}
                    required
                  />
                </label>
                <label>
                  Property address
                  <input
                    value={propertyAddress}
                    onChange={(event) => setPropertyAddress(event.target.value)}
                    maxLength={255}
                    required
                  />
                </label>
                <label>
                  Relationship to property
                  <select
                    value={propertyRelationship}
                    onChange={(event) =>
                      setPropertyRelationship(
                        event.target.value as OwnerVerificationSubmission["property_relationship"]
                      )
                    }
                  >
                    <option value="OWNER">Owner</option>
                    <option value="TENANT">Tenant</option>
                    <option value="AUTHORIZED_OPERATOR">Authorized operator</option>
                  </select>
                </label>
                <label>
                  Property identifier (if applicable)
                  <input
                    value={propertyIdentifier}
                    onChange={(event) => setPropertyIdentifier(event.target.value)}
                    maxLength={150}
                  />
                </label>
                <label>
                  Latitude
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    required
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    required
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                  />
                </label>
              </div>
              <label className="owner-verification__file-field" htmlFor="verification-documents">
                Property evidence (PDF, JPG, or PNG; up to 8 files)
                <input
                  id="verification-documents"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  multiple
                  required
                  onChange={(event) => setDocuments(Array.from(event.target.files ?? []))}
                />
                <small>
                  Owners can submit an ownership record. Tenants and operators should provide a lease or written authorization, plus supporting property evidence where appropriate.
                </small>
              </label>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit for review"}
              </button>
            </form>
          )}

          {message && (
            <p className="owner-verification__message" role="status" aria-live="polite">
              {message}
            </p>
          )}
        </>
      ) : (
        <p className="owner-verification__message" role="alert">
          {message || "Verification status is unavailable. Please retry."}
        </p>
      )}
    </section>
  );
}

export default OwnerVerification;
