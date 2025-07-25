User Story
Title: Search Onboarded Lawyer
As a user,
I want to search for a lawyer by name,
So that I can find and access a lawyer who is not listed in the top 5 displayed onboarded lawyers.
Acceptance Criteria
The top 5 onboarded lawyers are displayed by default.
A search input field is available above or near the list.
When a user types a name (partial or full), matching lawyers are returned.
If no matches are found, an appropriate message is shown.
The search is case-insensitive and supports partial matches.
Selecting a lawyer opens or highlights their profile/details.

Use Case: Search Onboarded Lawyer by Name
Item
Description
Use Case ID
UC-LAW-002
Use Case Name
Search Onboarded Lawyer by Name
Actor(s)
User (Admin, Manager, Support Agent)
Description
Enables the user to search onboarded lawyers by name if not listed in the top 5 shown by default.
Preconditions
User is logged in and lawyers are already onboarded.
Postconditions
Lawyer is found or user is informed of no match.

Main Flow
User accesses lawyer list page.
System displays top 5 onboarded lawyers.
User does not find desired lawyer.
User enters name into the search bar.
System searches onboarded lawyers by name.
System displays matched lawyer(s).
User selects lawyer to view or manage details.



Alternate Flow – No Match Found
System shows: “No onboarded lawyers found matching your search.”    

User Story: Voice Call a Lawyer 
Title: Schedule a Voice Call with a Lawyer (Payment at Checkout)
As a client using the app,
I want to choose "Voice Call" as my preferred consultation type when booking an appointment,
So that the lawyer will call me at the scheduled time, and I can pay for this service as part of the overall booking process.

Acceptance Criteria
The user can select "Voice Call" as the consultation method during appointment booking.
The system shows any additional fees for the voice call service.
The selected voice call type is reflected in the appointment summary and confirmation.
Payment (including the voice call fee) is processed at the final checkout stage.
Upon confirmation, the lawyer is notified to initiate a call at the scheduled time.
The user receives an appointment confirmation and instructions (e.g., "The lawyer will call you at the scheduled time").

Use Case: Schedule Voice Call Appointment with Lawyer
Field
Description
Use Case ID
UC-LAW-004
Use Case Name
Schedule Voice Call Appointment with Lawyer
Primary Actor
Client (User)
Secondary Actor
Lawyer
Description
The client schedules an appointment for a voice call. The lawyer will call the client at the scheduled time. The payment for this voice call service is included at checkout.


Preconditions
The user is logged in.
The lawyer is available for voice call appointments.
Voice call is enabled as a consultation method in the system.
The payment system is operational.
