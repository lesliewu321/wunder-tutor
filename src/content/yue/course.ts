import data from '../../../astra-lessons/courses/yue.json';
import { buildCourse, type CourseFile } from '../load';
export const YUE = buildCourse(data as unknown as CourseFile, 'astra-lessons/courses/yue.json');
export const YUE_COURSE = YUE.course;
export const YUE_ITEMS = YUE.items;
export const YUE_CHECK_ITEMS = YUE.check;
export const YUE_LAB_SOUNDS = YUE.labSounds;
export const YUE_LADDERS = YUE.ladders;
