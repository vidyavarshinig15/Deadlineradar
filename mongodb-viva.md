# MongoDB Viva Questions and Answers

These questions refer to the Deadline Radar implementation.

1. **What is MongoDB?**  
   A NoSQL document database that stores BSON documents in collections.

2. **What is the difference between a collection and a document?**  
   A collection groups related documents; a document is an individual BSON record, similar to a row but with nested fields and arrays.

3. **What does NoSQL mean here?**  
   The application models data as documents rather than relational tables. It can still enforce shape and validation through Mongoose.

4. **Why is a checklist embedded in an assignment?**  
   Checklist items are owned by one assignment and are generally read and changed along with that assignment. Embedding avoids an extra query for those small child records.

5. **Why are study sessions referenced rather than embedded?**  
   Sessions are separate records with their own create/update/delete lifecycle and can accumulate over time. They also support querying and grouping across assignments.

6. **What is an ObjectId?**  
   A BSON identifier commonly used as a MongoDB document `_id`. Here it also connects `studentId` and `assignmentId` references.

7. **What does Mongoose do?**  
   Mongoose is an Object Data Modeling library for Node.js. It defines schemas, casts values, validates documents, creates models and provides query APIs.

8. **What does `populate()` do?**  
   It replaces a referenced ObjectId in a query result with selected fields from the referenced collection. The study-session endpoint populates assignment title and subject.

9. **What does `$lookup` do?**  
   `$lookup` performs a left outer join between collections in an aggregation pipeline. Deadline Radar joins assignments with sessions for report totals.

10. **What does `$match` do?**  
    It filters pipeline documents. Dashboard aggregation first matches assignments belonging to the signed-in student.

11. **What does `$group` do?**  
    It combines documents sharing a group key and calculates aggregates, such as assignment counts, average completion, estimated hours or study minutes.

12. **What does `$project` do?**  
    It reshapes results by including/excluding fields and computing output fields. The report calculates total study minutes for each assignment.

13. **What does `$sort` do?**  
    It orders pipeline documents by one or more fields. Urgent assignments are ordered by descending risk, then earlier due date.

14. **What does `$unwind` do?**  
    It expands an array into separate pipeline documents. The checklist analytics route expands each assignment checklist before grouping completed items.

15. **What does `$facet` do?**  
    It executes several aggregation branches on the same matched input. The dashboard computes statuses, risk levels, subject totals, urgent assignments and overall totals in one pipeline.

16. **What are indexes and which fields are indexed?**  
    An index is a data structure that helps MongoDB find or sort matching documents efficiently. The schemas index student IDs, due dates, statuses, risk levels, assignment IDs and common field combinations.

17. **What is the trade-off of an index?**  
    It takes disk/memory space and MongoDB must maintain it during writes, so indexes should support actual query patterns rather than every field.

18. **How are schema rules enforced?**  
    Mongoose defines required fields, enum values and numeric boundaries. Zod validates incoming API payloads before model writes.

19. **How does the application avoid orphan study-session records?**  
    The assignment delete route deletes sessions matching both the assignment and student reference before deleting the assignment.

20. **What is aggregation?**  
    Aggregation is a staged data-processing pipeline. Each stage transforms, filters, joins, groups or reshapes records, and the next stage consumes its output.

21. **How are overdue assignments found?**  
    The assignment list and dashboard use date filters against `dueDate`, excluding completed assignments.

22. **Does MongoDB enforce a relational foreign key for these references?**  
    No. The application stores ObjectIds and checks the referenced assignment when creating a study session; MongoDB does not provide SQL-style foreign-key constraints.

23. **What happens when progress reaches 100%?**  
    The assignment is automatically marked Completed and its risk score becomes zero.

24. **Why doesn’t a long study session increase assignment completion?**  
    Duration does not reliably measure completed work. Sessions record effort, while the student updates progress explicitly.

25. **What is the purpose of the database name `deadline_radar`?**  
    It isolates this project’s three collections from unrelated local MongoDB databases.

26. **How does the application protect student accounts?**  
    It hashes passwords with bcrypt and stores a signed session token in an HTTP-only cookie; protected API queries use the authenticated student's ObjectId.

27. **Does the application insert sample assignments automatically?**  
    No. New accounts start with empty collections, and dashboard values are calculated from records the signed-in student has saved.
