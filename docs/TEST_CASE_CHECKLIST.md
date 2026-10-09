# ParkEase Test Case Checklist

## Purpose

This checklist documents the manual verification scope for Task 125. It is an execution record template, not a test-results report. Complete **Actual result**, **Pass/fail**, and **Remarks** only after manually executing each case.

## Test Setup

- Frontend running from `frontend/` with `npm run dev`.
- Backend API running on `http://127.0.0.1:8000`.
- PostgreSQL database running and initialized according to [LOCAL_DATABASE_RESET.md](LOCAL_DATABASE_RESET.md).
- One valid user account and one valid owner account available.
- At least one owner parking lot with capacity and at least one parking slot.
- A second user account available for ownership and authorization checks.
- Browser developer tools available for API status and responsive viewport checks.

## Execution Fields

For every case below:

- **Actual result:** Leave blank until executed.
- **Pass/fail:** Leave blank until executed. Use `Pass`, `Fail`, or `Blocked`.
- **Remarks:** Record evidence, defect IDs, screenshots, API responses, or blockers.

---

## Manual Test Cases

### TC-001 Registration

- **Description:** Register a new standard parking user.
- **Preconditions:** User is logged out; email address is not already registered.
- **Test steps:**
  1. Open the ParkEase homepage.
  2. Open the registration page.
  3. Enter a valid name, unique email, password of at least eight characters, and select `Parking User`.
  4. Submit the form.
- **Expected result:** Registration succeeds, a session is established, and the user is redirected to the user dashboard.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-002 Login

- **Description:** Log in with valid user credentials.
- **Preconditions:** A registered user account exists; user is logged out.
- **Test steps:**
  1. Open `/login`.
  2. Enter the registered email and password.
  3. Submit the form.
- **Expected result:** Login succeeds and the user is redirected to `/user-dashboard`.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-003 Invalid Login

- **Description:** Reject an invalid email or password.
- **Preconditions:** User is logged out.
- **Test steps:**
  1. Open `/login`.
  2. Enter an unknown email or incorrect password.
  3. Submit the form.
- **Expected result:** Login is rejected with an error message; no dashboard session is created; the user remains on the login page.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-004 User Role Access

- **Description:** Verify a user can access user-only functionality.
- **Preconditions:** Valid user account is logged in.
- **Test steps:**
  1. Open the user dashboard.
  2. Open parking search, parking details, reservations, and profile tabs.
  3. Request a user-only endpoint such as `/parking/lots/available` with the user token.
- **Expected result:** User dashboard and user features load; the user endpoint returns authorized data.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-005 Owner Role Access

- **Description:** Verify an owner can access owner management functionality.
- **Preconditions:** Valid owner account is logged in.
- **Test steps:**
  1. Open `/owner-dashboard`.
  2. Review parking management, statistics, and reservation monitoring sections.
  3. Request an owner-only endpoint such as `/parking/lots` with the owner token.
- **Expected result:** Owner dashboard and owner endpoints load with owner-scoped data.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-006 Parking Lot Creation

- **Description:** Create a parking lot as an owner.
- **Preconditions:** Owner is logged in; owner dashboard is open.
- **Test steps:**
  1. Enter a valid lot name, address, positive total capacity, and optionally a valid latitude/longitude pair.
  2. Submit `Create Parking Lot`.
  3. Refresh or reload the owner lot list.
- **Expected result:** The lot is created once, a success message appears, and the new lot is listed for the current owner.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-007 Parking Slot Creation

- **Description:** Create a parking slot in an owned lot.
- **Preconditions:** Owner is logged in and owns a lot with unused capacity.
- **Test steps:**
  1. Select or view the lot.
  2. Enter a valid slot number such as `A1`.
  3. Submit `Add Slot`.
  4. Refresh the slot information.
- **Expected result:** The slot is created, shown as available, and included in the lot summary.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-008 Parking Availability

- **Description:** Verify availability counts reflect slot state.
- **Preconditions:** A lot has known total capacity and at least one available slot.
- **Test steps:**
  1. Record the available and occupied counts in owner statistics or lot summary.
  2. Reserve one available slot as a user.
  3. Refresh the availability view.
- **Expected result:** The selected slot becomes occupied and available counts decrease by one without changing total capacity.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-009 Parking Search

- **Description:** Search, filter, and sort available parking lots.
- **Preconditions:** User is logged in; multiple parking lots with different names, addresses, and availability exist.
- **Test steps:**
  1. Open the `Find Parking` view.
  2. Search by part of a lot name and then by address text.
  3. Toggle `Available Now`.
  4. Change the sort option.
  5. Clear filters.
- **Expected result:** Results update correctly for the search and filters; sorting changes the displayed order; clearing filters restores the available list.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-010 GPS/Location

- **Description:** Verify location permission states and nearby filtering.
- **Preconditions:** User is logged in; browser location permission can be controlled.
- **Test steps:**
  1. Use `Use My Location` and allow permission.
  2. Confirm the location status and nearest-first message.
  3. Enable `Near Me`.
  4. Repeat with location permission denied or unavailable.
- **Expected result:** Granted location enables distance sorting/filtering; denied or unavailable location shows a useful message and preserves manual search functionality.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-011 Navigation

- **Description:** Open directions for a parking lot with coordinates.
- **Preconditions:** User is logged in; selected lot has valid latitude and longitude.
- **Test steps:**
  1. Select a lot from search or details.
  2. Activate `Navigate` or `Get Directions`.
- **Expected result:** A Google Maps directions URL opens in a new tab/window with the lot coordinates as the destination.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-012 Parking Detail Page

- **Description:** Open and inspect a parking lot detail page.
- **Preconditions:** User is logged in; a valid lot ID exists.
- **Test steps:**
  1. Open a lot from parking search or navigate directly to `/parking/{lotId}`.
  2. Review the lot name, address, capacity, availability, and slot list.
  3. Use `Back to dashboard`.
- **Expected result:** Details match the selected lot, current slot state is shown, and the back action returns to the user dashboard.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-013 Slot Selection

- **Description:** Select and deselect an available slot.
- **Preconditions:** User is logged in; a lot with at least one available slot is open.
- **Test steps:**
  1. Select an available slot.
  2. Select it again to deselect it, if the page supports toggling.
  3. Attempt to select an occupied slot.
- **Expected result:** Available slot selection is visibly updated; deselection works where supported; occupied slots cannot be selected.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-014 Reservation Confirmation

- **Description:** Verify the confirmation modal before creating a reservation.
- **Preconditions:** User is logged in and has selected an available slot.
- **Test steps:**
  1. Activate `Reserve`.
  2. Review the modal details.
  3. Close it with Cancel, the close button, backdrop, and Escape in separate attempts.
- **Expected result:** The modal shows the correct lot, address, slot, and availability; each close method returns to the slot view without creating a reservation.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-015 Successful Reservation

- **Description:** Complete a reservation for an available slot.
- **Preconditions:** User is logged in; an available slot is selected; no competing reservation exists.
- **Test steps:**
  1. Open the reservation confirmation modal.
  2. Activate `Confirm Reservation` once.
  3. Wait for the request to complete.
- **Expected result:** The reservation succeeds, a confirmation view shows the reservation details, and the slot is no longer available.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-016 Reservation History

- **Description:** View the current user’s reservation history.
- **Preconditions:** User is logged in; the user has at least one reservation or an empty account.
- **Test steps:**
  1. Open `My Reservations`.
  2. Review reservation ID, lot, slot, timestamp, and status.
  3. Refresh the list.
- **Expected result:** Only the current user’s reservations are shown with correct details; loading and empty states are meaningful.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-017 Reservation Cancellation

- **Description:** Cancel an active reservation.
- **Preconditions:** User is logged in and has an active reservation.
- **Test steps:**
  1. Open reservation history.
  2. Activate `Cancel Reservation`.
  3. Review the cancellation modal.
  4. Confirm cancellation once.
- **Expected result:** The reservation changes to cancelled, the success message appears, and repeated cancellation is prevented.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-018 Availability After Cancellation

- **Description:** Verify a cancelled reservation releases its slot.
- **Preconditions:** An active reservation exists for a known slot.
- **Test steps:**
  1. Record the slot availability before cancellation.
  2. Cancel the reservation.
  3. Refresh parking search, slot details, and any availability summary.
- **Expected result:** The cancelled slot becomes available and availability counts increase accordingly.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-019 Owner Statistics

- **Description:** Verify owner summary statistics.
- **Preconditions:** Owner has one or more lots with known capacities and slot states.
- **Test steps:**
  1. Open the owner dashboard.
  2. Compare parking lots, total capacity, created slots, available slots, occupied slots, availability rate, and occupancy rate against known data.
  3. Refresh after a reservation or cancellation.
- **Expected result:** Counts and percentages match the current database state and refresh correctly.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-020 Owner Reservation Monitoring

- **Description:** Verify an owner can monitor reservations in owned lots.
- **Preconditions:** Owner has at least one lot with user reservations and, where possible, different reservation statuses.
- **Test steps:**
  1. Open owner reservation monitoring.
  2. Review lot, slot, status, reservation ID, and timestamp.
  3. Apply each status filter.
  4. Refresh the data.
- **Expected result:** Only reservations in the owner’s lots are displayed; filters and refresh show the correct records and counts.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-021 Unauthorized Access

- **Description:** Reject unauthenticated and cross-role access.
- **Preconditions:** Logged-out browser session, user token, and owner token are available.
- **Test steps:**
  1. Open `/user-dashboard`, `/owner-dashboard`, and `/parking/{lotId}` while logged out.
  2. Open owner routes with a user token.
  3. Open user routes with an owner token.
  4. Call protected API endpoints with no token and with the wrong role.
- **Expected result:** Unauthenticated users are redirected to login or receive `401`; wrong-role users are redirected to their own dashboard or receive `403` according to the endpoint contract; no protected data is exposed.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-022 API Validation

- **Description:** Verify request validation and domain validation errors.
- **Preconditions:** API is running; valid role tokens are available.
- **Test steps:**
  1. Submit registration with missing or invalid fields and a duplicate email.
  2. Submit a parking lot with missing required fields, invalid capacity, or incomplete coordinates.
  3. Submit a slot with invalid format, duplicate number, nonexistent lot, or full capacity.
  4. Submit reservations with nonexistent IDs, mismatched lot/slot IDs, or an occupied slot.
  5. Submit cancellation with an invalid ID, another user’s reservation, or an already cancelled reservation.
- **Expected result:** API returns the documented validation or domain error status and message; invalid data is not persisted; frontend surfaces a usable error.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-023 Responsive/Mobile UI

- **Description:** Verify core flows at desktop, tablet, and mobile widths.
- **Preconditions:** Browser responsive tools available; test account exists.
- **Test steps:**
  1. Test homepage, login, registration, user dashboard, parking search, modals, and owner dashboard at desktop width.
  2. Repeat at tablet width.
  3. Repeat at a narrow mobile width.
  4. Use keyboard navigation and visible focus on each width.
- **Expected result:** Content remains usable without unintended horizontal overflow; mobile menu opens/closes; forms, cards, tables, maps, buttons, and dialogs remain usable.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

### TC-024 Loading/Error/Empty States

- **Description:** Verify feedback for loading, failure, and empty data conditions.
- **Preconditions:** Browser developer tools or test environment can throttle/fail API requests; accounts with empty data are available where possible.
- **Test steps:**
  1. Throttle or delay login, registration, lot loading, slot loading, reservation loading, and refresh requests.
  2. Simulate backend unavailable or API error responses.
  3. View an account with no lots, no slots, or no reservations.
  4. Retry failed operations where a retry control is provided.
- **Expected result:** Loading indicators and button states prevent duplicate actions; errors are visible and actionable; empty states explain the condition; retry restores the normal flow when the service recovers.
- **Actual result:**
- **Pass/fail:**
- **Remarks:**

---

## Automation Candidates

The following cases are suitable for automation after the manual workflow and test-data setup are stable:

- **Backend API tests with pytest/FastAPI TestClient:** TC-001, TC-002, TC-003, TC-004, TC-005, TC-006, TC-007, TC-008, TC-015, TC-017, TC-018, TC-019, TC-020, TC-021, and TC-022.
- **Authorization matrix tests:** Verify unauthenticated, user, and owner access for every protected endpoint, including expected `401`, `403`, and successful responses.
- **Reservation consistency tests:** Verify reservation creation marks a slot unavailable, duplicate reservation attempts fail, cancellation restores availability, and cancellation ownership is enforced.
- **Frontend end-to-end tests with Playwright:** TC-001 through TC-005, TC-009, TC-012 through TC-018, TC-020, TC-021, and selected responsive checks from TC-023.
- **Frontend component tests:** Registration and login form validation, loading/error rendering, role selection, reservation modal content/actions, cancellation modal behavior, filters, and empty states.
- **Visual or viewport smoke tests:** Homepage mobile menu, auth layout, user dashboard tabs, parking cards, tables, and modal layouts at representative desktop/tablet/mobile widths.
- **Current automated coverage:** `backend/tests/test_requirements.py` verifies that `python-multipart` is present for form-based login. It does not replace the functional cases above.

## Execution Notes

- Do not mark a case as passed based on code inspection or a successful build alone.
- Record the browser, viewport, account role, test data IDs, timestamp, and API response status in **Remarks** when executing a case.
- Keep failed evidence with the case: screenshot, console/API output, reproduction steps, and defect reference.
