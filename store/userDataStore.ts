import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

interface UserData {
    id: string;
    name: string;
    email: string;
    image: string;
}

interface UserState {
    setUserData: (userDate: UserData) => void;
}

export const useUserDataStore = create<UserData & UserState>()(immer((set) => ({
    id: "",
    name: "",
    email: "",
    image: "",
    setUserData: (userDate: UserData) => set(() => ({ ...userDate })),
})))