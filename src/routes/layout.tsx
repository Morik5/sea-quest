import { component$, Slot } from "@builder.io/qwik";
import { useLocation, type RequestHandler } from "@builder.io/qwik-city";
import { Sidebar } from "../components/router-head/sidebar/sidebar";


export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 5,
  });
};

export default component$(() => {
  const location = useLocation();
  const isLoginPage = location.url.pathname === "/login/";
  console.log("Current URL path:", location.url.pathname); 
  console.log("isLoginPage:", isLoginPage); 

  return (
    <>
      <main>
        
        {!isLoginPage && <Sidebar />}
        <section>
          <Slot />
        </section>
      </main>
    </>
  );
});