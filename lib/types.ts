export type Message = {
  id: string;
  room_id: string;
  username: string;
  message: string;
  sender_type: "user" | "admin" | "operator";
  created_at: string;
};

export type Rating = {
  id: string;
  username: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  replied_by: string | null;
  created_at: string;
  replied_at: string | null;
};
