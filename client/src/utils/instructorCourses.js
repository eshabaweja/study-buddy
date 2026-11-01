import { courses } from './api';

/** Courses owned by the logged-in instructor, sorted by code. */
export async function fetchInstructorCoursesSorted() {
  const data = await courses.getMine();
  return [...data.courses].sort((a, b) => a.code.localeCompare(b.code));
}
