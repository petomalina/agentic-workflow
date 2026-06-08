import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SearchBar } from "@/components/search-bar"

describe("<SearchBar />", () => {
  it("renders the current value", () => {
    render(<SearchBar value="ada" onChange={() => {}} />)
    expect(screen.getByRole("searchbox")).toHaveValue("ada")
  })

  it("calls onChange as the user types", async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    render(<SearchBar value="" onChange={handleChange} />)

    await user.type(screen.getByRole("searchbox"), "a")

    expect(handleChange).toHaveBeenCalledWith("a")
  })

  it("shows the provided placeholder", () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Find someone" />)
    expect(screen.getByPlaceholderText("Find someone")).toBeInTheDocument()
  })
})
