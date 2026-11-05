export const courseNames = [
  'Artificial Intelligence',
  'Analysis of Algorithms',
  'Parallel and Distributed Computing',
  'Web Technologies',
  'Linear Algebra',
  'Professional Practice',
  'HQ',
]

export const courses = courseNames.map((name, index) => ({
  id: index + 1,
  name,
}))
