import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export const NotFoundPage = () => (
  <div className="flex min-h-[52vh] items-center justify-center py-6">
    <Card className="max-w-md text-center" padding="md">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">404</p>
      <h1 className="mt-3 text-[1.9rem] font-extrabold text-ink-900 sm:text-[2.4rem]">Хуудас олдсонгүй</h1>
      <div className="mt-5">
        <Link to="/">
          <Button>Нүүр рүү буцах</Button>
        </Link>
      </div>
    </Card>
  </div>
);

