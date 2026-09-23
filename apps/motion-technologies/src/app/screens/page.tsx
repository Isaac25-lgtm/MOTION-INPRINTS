import { notFound } from "next/navigation";
import {
  Mock,
  PhoneFieldMock,
  PhoneShopMock,
  SecurityMock,
} from "@/components/ui/Mockups";
import type { VisualKey } from "@/content/solutions";
import "@/styles/mockups.css";

/**
 * Development-only capture surface for scripts/build-tech-assets.py: renders
 * one interface design full size so it can be screenshotted and composited
 * onto licensed device photographs. Returns 404 in production builds.
 *
 *   /screens?v=health          laptop-sized window
 *   /screens?phone=field       phone-sized app screen
 */
type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const visuals: VisualKey[] = [
  "health",
  "me",
  "business",
  "sacco",
  "education",
  "pos",
  "web",
  "marketing",
  "analytics",
  "custom",
];

export const metadata = { robots: { index: false, follow: false } };

export default async function Screens({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") notFound();
  const { v, phone } = await searchParams;
  if (phone === "field" || phone === "shop") {
    return (
      <div className="screens">
        <div className="screens__phone" data-screen>
          {phone === "field" ? <PhoneFieldMock /> : <PhoneShopMock />}
        </div>
      </div>
    );
  }
  const visual = visuals.find((x) => x === v);
  return (
    <div className="screens">
      <div className="screens__laptop" data-screen>
        {v === "security" ? <SecurityMock /> : <Mock visual={visual ?? "me"} />}
      </div>
    </div>
  );
}
