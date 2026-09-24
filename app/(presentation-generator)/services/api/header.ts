export const getHeader = () => {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

/** Leave Content-Type unset so the browser can add the multipart boundary. */
export const getHeaderForFormData = () => {
  return {};
};
