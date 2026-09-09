"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Box,
  Tag,
  TagDollar,
  Boxes3,
  QrCode,
  Pencil,
  TrashBin,
  ArrowRight,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Modal, Toast, toast, useOverlayState, Spinner } from "@heroui/react";

function ProductCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-[1.75rem] bg-surface-container-low p-5 shadow-[8px_8px_20px_rgba(184,196,214,0.55),-8px_-8px_20px_rgba(255,255,255,0.9)] animate-pulse">
      <div className="h-14 w-14 shrink-0 rounded-2xl bg-surface-container" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-4 w-2/5 rounded-full bg-surface-container" />
        <div className="h-3 w-3/5 rounded-full bg-surface-container" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="h-4 w-10 rounded-full bg-surface-container" />
        <div className="h-9 w-9 rounded-full bg-surface-container" />
        <div className="h-9 w-9 rounded-full bg-surface-container" />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: "", description: "", price: "", stock: "", barcode: "" },
  });

  // ── Edit modal state ────────────────────────────────────────
  const editModal = useOverlayState();
  const [editingProduct, setEditingProduct] = useState(null);
  const editForm = useForm({
    defaultValues: { name: "", description: "", price: "", stock: "", barcode: "" },
  });

  // ── Delete confirmation modal state ─────────────────────────
  const deleteModal = useOverlayState();
  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, name }
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch("/api/proxy/products");
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't load products", { description: "Check your connection and try again." });
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const onSubmit = async (data) => {
    try {
      const res = await fetch("/api/proxy/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const created = await res.json();

      if (!res.ok) {
        toast.danger("Couldn't add product", { description: created.error || "Please try again." });
        return;
      }

      setProducts((prev) => [...prev, created]);
      reset();
      toast.success("Product added", { description: `${created.name} is now in your catalog.` });
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't add product", { description: "Something went wrong." });
    }
  };

  // ── Delete flow: click asks for confirmation, modal button does the real work ──
  const askDelete = (product) => {
    setDeleteTarget(product);
    deleteModal.open();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/proxy/products/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (!res.ok) {
        toast.danger("Couldn't delete product", { description: result.error || "Please try again." });
        return;
      }

      setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      toast.success("Product deleted", { description: `${deleteTarget.name} was removed.` });
      deleteModal.close();
      setDeleteTarget(null);
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't delete product", { description: "Something went wrong." });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Edit flow: click opens modal pre-filled with current values ──
  const onEdit = (product) => {
    setEditingProduct(product);
    editForm.reset({
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock,
      barcode: product.barcode || "",
    });
    editModal.open();
  };

  const onEditSubmit = async (data) => {
    try {
      const res = await fetch(`/api/proxy/products/${editingProduct._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.danger("Couldn't update product", { description: result.error || "Please try again." });
        return;
      }

      setProducts((prev) =>
        prev.map((p) => (p._id === editingProduct._id ? { ...p, ...data } : p))
      );
      toast.success("Product updated", { description: `${data.name} was saved.` });
      editModal.close();
      setEditingProduct(null);
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't update product", { description: "Something went wrong." });
    }
  };

  return (
    <main className="w-full bg-surface min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface p-1.5 shadow-[5px_5px_12px_rgba(184,196,214,0.55),-5px_-5px_12px_rgba(255,255,255,0.95)]">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#ff5d00] to-[#ff8c4b]">
              <Box className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Product Catalog
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-sm">
            Add, edit, and remove items your kiosk sells.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">

          {/* ── Add product form ────────────────────────────── */}
          <div className="h-fit rounded-[2rem] bg-surface-container-low p-6 shadow-[12px_12px_28px_rgba(184,196,214,0.65),-12px_-12px_28px_rgba(255,255,255,0.95)]">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-5">
              Add a product
            </h2>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-1.5">
                <label htmlFor="name" className="block font-label-md text-label-md text-on-surface font-semibold">
                  Name
                </label>
                <div className="relative flex items-center rounded-full bg-surface-container shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all">
                  <Tag className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
                  <input
                    id="name"
                    type="text"
                    placeholder="Sparkling Water"
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                    {...register("name", { required: true })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className="block font-label-md text-label-md text-on-surface font-semibold">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={2}
                  placeholder="500ml, chilled"
                  className="w-full resize-none rounded-2xl bg-surface-container px-4 py-3 shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none focus:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all"
                  {...register("description")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="price" className="block font-label-md text-label-md text-on-surface font-semibold">
                    Price
                  </label>
                  <div className="relative flex items-center rounded-full bg-surface-container shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all">
                    <TagDollar className="text-tertiary w-4 h-4 mr-2 shrink-0" />
                    <input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="45"
                      className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                      {...register("price", { required: true, valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="stock" className="block font-label-md text-label-md text-on-surface font-semibold">
                    Stock
                  </label>
                  <div className="relative flex items-center rounded-full bg-surface-container shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all">
                    <Boxes3 className="text-tertiary w-4 h-4 mr-2 shrink-0" />
                    <input
                      id="stock"
                      type="number"
                      placeholder="32"
                      className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                      {...register("stock", { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="barcode" className="block font-label-md text-label-md text-on-surface font-semibold">
                  Barcode
                </label>
                <div className="relative flex items-center rounded-full bg-surface-container shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all">
                  <QrCode className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
                  <input
                    id="barcode"
                    type="text"
                    placeholder="8901030812345"
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                    {...register("barcode")}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group mt-2 flex w-full items-center justify-between rounded-full bg-surface p-2 pl-6 shadow-[6px_6px_14px_rgba(184,196,214,0.6),-6px_-6px_14px_rgba(255,255,255,0.95)] transition-all hover:shadow-[8px_8px_18px_rgba(184,196,214,0.7),-8px_-8px_18px_rgba(255,255,255,1)] active:shadow-[inset_3px_3px_6px_rgba(184,196,214,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight group-hover:text-primary-container transition-colors">
                  {isSubmitting ? "Adding..." : "Add product"}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-[4px_6px_14px_rgba(255,93,0,0.38),-2px_-2px_6px_rgba(255,140,75,0.4)] transition-transform group-hover:scale-105 group-active:scale-95">
                  {isSubmitting ? <Spinner size="sm" color="current" /> : <ArrowRight className="h-5 w-5" />}
                </div>
              </button>
            </form>
          </div>

          {/* ── Product list ───────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {isLoadingProducts ? (
              <>
                <ProductCardSkeleton />
                <ProductCardSkeleton />
                <ProductCardSkeleton />
              </>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[2rem] bg-surface-container-low py-16 px-6 text-center shadow-[inset_3px_3px_8px_rgba(184,196,214,0.4),inset_-3px_-3px_8px_rgba(255,255,255,0.8)]">
                <Box className="h-8 w-8 text-tertiary mb-3" />
                <p className="font-headline-sm text-headline-sm text-on-surface">
                  No products yet
                </p>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xs">
                  Add your first item using the form to see it listed here.
                </p>
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product._id}
                  className="flex items-center gap-4 rounded-[1.75rem] bg-surface-container-low p-5 shadow-[8px_8px_20px_rgba(184,196,214,0.55),-8px_-8px_20px_rgba(255,255,255,0.9)]"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[inset_2px_2px_5px_rgba(184,196,214,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                    <Box className="h-6 w-6 text-tertiary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                        {product.name}
                      </h3>
                      {product.stock === 0 ? (
                        <span className="shrink-0 rounded-full bg-error-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-error-container">
                          Out of stock
                        </span>
                      ) : product.stock < 5 ? (
                        <span className="shrink-0 rounded-full bg-primary-fixed px-2.5 py-0.5 font-label-sm text-label-sm text-on-primary-fixed-variant">
                          Low stock · {product.stock}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                          {product.stock} in stock
                        </span>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                      {product.description || "No description"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-headline-sm text-headline-sm text-primary whitespace-nowrap">
                      ৳{product.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      aria-label="Edit product"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-tertiary shadow-[3px_3px_8px_rgba(184,196,214,0.5),-3px_-3px_8px_rgba(255,255,255,0.9)] transition-colors hover:text-primary-container cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => askDelete(product)}
                      aria-label="Delete product"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-tertiary shadow-[3px_3px_8px_rgba(184,196,214,0.5),-3px_-3px_8px_rgba(255,255,255,0.9)] transition-colors hover:text-error cursor-pointer"
                    >
                      <TrashBin className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Delete confirmation modal ────────────────────────── */}
      <Modal state={deleteModal}>
        <Modal.Trigger className="hidden" aria-hidden="true" />
        <Modal.Backdrop>
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Icon>
                  <TriangleExclamation className="h-5 w-5 text-error" />
                </Modal.Icon>
                <Modal.Heading>Delete this product?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {deleteTarget
                    ? `"${deleteTarget.name}" will be permanently removed from your catalog. This can't be undone.`
                    : ""}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <button
                  type="button"
                  onClick={() => deleteModal.close()}
                  disabled={isDeleting}
                  className="rounded-full px-5 py-2.5 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 rounded-full bg-error px-5 py-2.5 font-label-lg text-label-lg text-on-error transition-opacity hover:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDeleting && <Spinner size="sm" color="current" />}
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Edit product modal ───────────────────────────────── */}
      <Modal state={editModal}>
        <Modal.Trigger className="hidden" aria-hidden="true" />
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Edit product</Modal.Heading>
              </Modal.Header>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
                <Modal.Body>
                  <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-label-md text-label-md text-on-surface font-semibold">
                        Name
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-full bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none"
                        {...editForm.register("name", { required: true })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-label-md text-label-md text-on-surface font-semibold">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        className="w-full resize-none rounded-2xl bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none"
                        {...editForm.register("description")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block font-label-md text-label-md text-on-surface font-semibold">
                          Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded-full bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none"
                          {...editForm.register("price", { required: true, valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block font-label-md text-label-md text-on-surface font-semibold">
                          Stock
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-full bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none"
                          {...editForm.register("stock", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-label-md text-label-md text-on-surface font-semibold">
                        Barcode
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-full bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none"
                        {...editForm.register("barcode")}
                      />
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <button
                    type="button"
                    onClick={() => editModal.close()}
                    className="rounded-full px-5 py-2.5 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editForm.formState.isSubmitting}
                    className="flex items-center gap-2 rounded-full bg-primary-container px-5 py-2.5 font-label-lg text-label-lg text-on-primary transition-opacity hover:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {editForm.formState.isSubmitting && <Spinner size="sm" color="current" />}
                    {editForm.formState.isSubmitting ? "Saving..." : "Save changes"}
                  </button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </main>
  );
}
