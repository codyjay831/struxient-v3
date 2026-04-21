# Implementation Report: Customer Delivery Content Backbone

## Mission
Implement the smallest durable content layer for customer share delivery messages. This pass replaces hardcoded message strings with a structured content backbone, enabling safe variable interpolation and method-aware (Email vs SMS) content generation while preserving the audited delivery bridge and provider execution path.

## What Changed
- **Content Backbone**: Created `src/server/comms/delivery-content.ts` defining:
    - `DeliveryContentVariables`: Explicit contract for interpolated data (Customer Name, Project Name, Portal URL, Company Name).
    - `renderEmailContent`: Generates structured Email subject, text body, and HTML body.
    - `renderSmsContent`: Generates concise SMS text body.
- **Read Model**: Updated `getFlowExecutionReadModel` and `FlowExecutionApiDto` to include the `Customer`, `Project` (FlowGroup), and `Tenant` names required for message interpolation.
- **Mutations**:
    - Updated `sendFlowShareForTenant` to fetch the necessary names within the transaction.
    - Integrated the new content rendering layer before invoking the `CommsProvider`.
- **Office UI**:
    - Enhanced `FlowShareControls` to include a live **Message Preview** section.
    - The preview updates in real-time as the user toggles between Email and SMS methods.
    - Variables are resolved on the client using the updated DTO data, providing high-fidelity feedback to the office user.

## Exact Files Changed
- `src/server/comms/delivery-content.ts` (New)
- `src/server/slice1/reads/flow-execution.ts`
- `src/lib/flow-execution-dto.ts`
- `src/server/slice1/mutations/flow-share-delivery.ts`
- `src/components/execution/flow-share-controls.tsx`
- `src/app/(office)/flows/[flowId]/page.tsx`
- `src/app/dev/work-feed/[flowId]/page.tsx`

## Content Contract & Variables
The backbone uses a strict variable set to ensure consistency and prevent arbitrary script injection:
- `customerName`: Resolved from `Customer.name`.
- `projectName`: Resolved from `FlowGroup.name`.
- `portalUrl`: Constructed from the request origin and `publicShareToken`.
- `companyName`: Resolved from `Tenant.name`.

## Method-Specific Behavior
- **Email**: Includes a clear subject line and a rich HTML body with a call-to-action link, alongside a plain-text fallback.
- **SMS**: Optimizes for brevity, providing the essential project context and the shortened portal link.

## Tests Added/Updated
- Created and successfully ran `scripts/integration/customer-delivery-content.integration.test.ts` (deleted after run) which verified:
    - Correct interpolation of all four variables in both Email and SMS bodies.
    - Correct Subject line generation for emails.
    - Successful propagation through the `sendFlowShareForTenant` mutation and `MockCommsProvider`.

## What was Intentionally Left Out
- **WYSIWYG Editor**: Content is currently defined in code for durability and consistency; no ad-hoc editing in the UI.
- **Multi-Template Engine**: A single high-quality template is used per method.
- **Localization**: Content is currently English-only.
- **Branding**: No per-tenant logo or color customization in the email HTML yet.

## Known Follow-up Gaps
- **Rich HTML Templates**: Future epics can introduce MJML or similar for more sophisticated email layouts.
- **Template Storage**: Moving templates from code to the database if tenant-specific customization is required.
- **Variable Expansion**: Adding more variables (e.g., Job Address, Due Date) as more domain data is wired into the execution slice.
