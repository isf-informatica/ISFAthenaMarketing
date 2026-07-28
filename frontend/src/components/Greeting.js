/* ==========================================================
   Returns "Good morning" / "Good afternoon" / "Good evening"
   based on the visitor's local device time.
   - 5:00–11:59  -> Good morning
   - 12:00–16:59 -> Good afternoon
   - 17:00–4:59  -> Good evening
========================================================== */
export const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
};