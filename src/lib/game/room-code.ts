import { customAlphabet } from "nanoid";

// Unambiguous alphabet — no 0/O/1/I/L confusion when players read a room
// code aloud or type it on a phone keyboard.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const generateRoomCode = customAlphabet(ALPHABET, 5);
