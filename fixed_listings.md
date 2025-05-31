# Debugging Report: Public Listings and 'About Us' Page Issues

This document outlines the troubleshooting steps taken to resolve issues related to non-visible product listings on the public interface and a 'Failed to fetch' error for team member data on the 'About Us' page.

## 1. Initial Problems Identified

*   **Product Listings Not Visible:** Listings were not appearing on the public-facing property pages.
*   **'About Us' Page Error:** The 'About Us' page showed a "Failed to fetch" error when trying to load team member data.

## 2. Investigation and Debugging Steps

The debugging process involved several iterative steps of log analysis, code inspection, and applying fixes:

### 2.1. Initial Setup and Log Analysis
*   Started the application using `docker-compose up -d`.
*   Monitored logs for `frontend` and `backend` services.
*   Initial frontend logs showed errors like `getaddrinfo ENOTFOUND proxyhttps` and `Failed to parse URL from /api/settings/`, indicating problems with API URL construction.

### 2.2. API URL Misconfiguration (Server-Side Rendering - SSR)

*   **Observation:** The `frontend` service, during server-side rendering, was attempting to construct API URLs like `http://proxyhttps://your.domain.com/api/...` which is invalid.
*   **File Affected:** [`frontend/services/propertyService.js`](frontend/services/propertyService.js)
*   **Incorrect Logic (Initial):**
    ```javascript
    const API_BASE = IS_SERVER
      ? `http://proxy${process.env.NEXT_PUBLIC_API_URL || '/api'}` // Problematic
      : (process.env.NEXT_PUBLIC_API_URL || '/api');
    ```
*   **Correction 1:** Changed the SSR portion to `http://proxy/api`. This ensured internal Docker service discovery was used correctly for SSR.
    ```javascript
    const API_BASE = IS_SERVER
      ? `http://proxy/api` // Corrected for SSR
      : (process.env.NEXT_PUBLIC_API_URL || '/api');
    ```
*   **Docker Cache Issue:** Changes were not immediately reflected due to Docker's build cache. Rebuilding the `frontend` image (`docker-compose up -d --build frontend`) was necessary.
*   **Similar issue in `settingsService.js`:** The [`frontend/services/settingsService.js`](frontend/services/settingsService.js) had a similar issue where it defaulted to `/api` for SSR, causing "Failed to parse URL" errors.
*   **Correction 2:** Updated [`frontend/services/settingsService.js`](frontend/services/settingsService.js) to use `http://proxy/api` for SSR and `/api` for client-side, mirroring the `propertyService.js` logic.

### 2.3. API URL Misconfiguration (Client-Side Rendering)

*   **Observation:** After fixing SSR, browser console logs showed the 'About Us' page still trying to fetch from `https://your.domain.com/team/` (a placeholder URL), resulting in `net::ERR_NAME_NOT_RESOLVED`.
*   **File Affected (Initial thought):** [`frontend/services/propertyService.js`](frontend/services/propertyService.js)
*   **Incorrect Logic (Client-side part of Correction 1):**
    ```javascript
    const API_BASE = IS_SERVER
      ? `http://proxy/api`
      : (process.env.NEXT_PUBLIC_API_URL || '/api'); // Still problematic if NEXT_PUBLIC_API_URL is set to a full domain
    ```
*   **Correction 3:** Modified client-side `API_BASE` in [`frontend/services/propertyService.js`](frontend/services/propertyService.js) to always be `'/api'`.
    ```javascript
    const API_BASE = IS_SERVER
      ? `http://proxy/api`
      : '/api'; // Always use relative /api for client-side
    ```
*   **File Affected (Actual for 'About Us'):** [`frontend/pages/about.js`](frontend/pages/about.js)
*   **Observation:** The `AboutPage` component was directly using `process.env.NEXT_PUBLIC_API_URL` to construct its API call, bypassing the corrected service logic.
*   **Correction 4:** Modified the fetch call in [`frontend/pages/about.js`](frontend/pages/about.js:19) to use the relative path `/api/team/`. This resolved the 'About Us' page data fetching.

### 2.4. Public Properties Page - Listings Not Visible

*   **Observation:** Even after API URL fixes, listings were not showing on the public `/properties` page. Admin side was working.
*   **Debugging:** Added `console.log` statements to `getServerSideProps` in [`frontend/pages/properties/index.js`](frontend/pages/properties/index.js).
*   **Key Log Findings:**
    *   `[getServerSideProps] All properties fetched: 20`
    *   `[getServerSideProps] Available properties after filter: 0`
*   **Analysis:** This indicated that `fetchProperties()` was successful, but the filter `allProperties.filter(property => property.status === 'available')` was removing all properties.
*   **Further Logging:** Logged a sample property object.
*   **Discovery:** The property data from the backend **did not contain a `status` field**. It had a `listing_type` field (which was `null` in the sample).
*   **User Clarification:** The requirement was that all non-deleted listings should be visible by default on the public properties page. The filtering for "deleted" is handled by the backend.

## 3. Final Solution for Public Listings

*   **File Affected:** [`frontend/pages/properties/index.js`](frontend/pages/properties/index.js)
*   **Change:** Removed the filter `const availableProperties = allProperties.filter(property => property.status === 'available');` from `getServerSideProps`. Instead, all properties fetched by `fetchProperties()` are now passed directly to the page component.
    ```javascript
    // Inside getServerSideProps in frontend/pages/properties/index.js
    const allProperties = await fetchProperties();
    // Removed: const availableProperties = allProperties.filter(property => property.status === 'available');
    return { props: { properties: allProperties } }; // Pass all fetched properties
    ```
*   **Outcome:** This change successfully made the listings visible on the public properties page.

## 4. Admin Property Edit Page - React Error #321

*   **Problem:** The admin page for editing a property (`/admin/properties/edit/[id].js`) was not loading and showed a "Minified React error #321" in the console.
*   **Cause:** This error typically indicates a violation of the Rules of Hooks, such as calling hooks conditionally or from within other hooks. Inspection of [`frontend/pages/admin/properties/edit/[id].js`](frontend/pages/admin/properties/edit/[id].js) revealed that `useEffect` hooks for map initialization and synchronization were nested inside the main data-fetching `useEffect` hook.
*   **Solution:** The nested `useEffect` hooks were moved to the top level of the `EditPropertyPage` component function.
    *   The main data-fetching `useEffect` now correctly fetches initial data.
    *   The map-related `useEffect` hooks now run independently at the top level, with their dependency arrays ensuring they execute at the appropriate times (e.g., after data loading is complete and `propertyId` is available).
*   **Outcome:** This refactoring resolved the React error #321, allowing the admin property edit page to load and function correctly.

## Summary of Key Fixes:

1.  **Corrected API Base URL construction** in [`frontend/services/propertyService.js`](frontend/services/propertyService.js) and [`frontend/services/settingsService.js`](frontend/services/settingsService.js) to differentiate between server-side (`http://proxy/api`) and client-side (`/api`) calls.
2.  **Ensured Docker image was rebuilt** after changes to reflect them in the running container.
3.  **Corrected direct API call** in [`frontend/pages/about.js`](frontend/pages/about.js:19) to use the relative `/api/team/` path.
4.  **Removed incorrect status-based filtering** in [`frontend/pages/properties/index.js`](frontend/pages/properties/index.js:78-80), as property data used `listing_type` and the requirement was to show all non-deleted listings by default.