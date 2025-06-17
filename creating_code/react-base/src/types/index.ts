export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  price: number;
  duration: string;
  level: string;
  category: string;
  thumbnail: string;
  rating: number;
  enrolled: number;
  featured: boolean;
}

export interface Instructor {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  expertise: string[];
  rating: number;
  students: number;
  courses: number;
}

export interface Review {
  id: string;
  courseId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CategoryStats {
  name: string;
  count: number;
  icon: string;
}

export interface EnrollmentDetails {
  courseId: string;
  price: number;
}
