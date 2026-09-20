"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export function Header({
  title,
  extra = "",
}: {
  title: string;
  extra?: string;
}) {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b bg-background px-6 py-3 flex items-center justify-between">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">
                <Button variant={"ghost"} size={"sm"}>
                  首页
                </Button>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {!extra ? (
              <>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>

                <BreadcrumbItem>
                  <BreadcrumbPage>
                    <Button variant={"ghost"} size={"sm"}>
                      {title}
                    </Button>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>

                <BreadcrumbItem>
                  <BreadcrumbLink>
                    <Button
                      variant={"ghost"}
                      size={"sm"}
                      onClick={() => {
                        redirect("/" + title.toLowerCase());
                      }}
                    >
                      {title}
                    </Button>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator>/</BreadcrumbSeparator>

                <BreadcrumbItem>
                  <BreadcrumbPage>
                    <Button variant={"ghost"} size={"sm"}>
                      {extra}
                    </Button>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="font-bold text-lg">{title}</div>
      </div>
    </header>
  );
}
