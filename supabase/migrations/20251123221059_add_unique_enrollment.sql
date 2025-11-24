-- Add UNIQUE constraint to prevent duplicate enrollments
-- This ensures a user can only be enrolled in a course once

ALTER TABLE user_courses
ADD CONSTRAINT user_course_unique UNIQUE (user_id, course_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT user_course_unique ON user_courses IS 
'Prevents duplicate enrollments - ensures each user can only be enrolled in each course once';

