import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page-body">
      <div className="page-heading">
        <h1>Page not found / Página no encontrada</h1>
        <p>We could not find this page. / No se encontró esta página.</p>
      </div>
      <Link className="button" href="/">
        Home / Inicio
      </Link>
    </div>
  );
}
